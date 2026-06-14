// Shared proxy helper for HiClaw API routes
import { NextRequest, NextResponse } from 'next/server';

const TIMEOUT_MS = 10000;

// Allowed controller URL hosts to prevent SSRF (only applies to user-supplied ?controllerUrl=)
// In production/k3s mode the env var HICLAW_CONTROLLER_URL is authoritative.
const ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'hiclaw-controller',
  'hiclaw-controller.hiclaw-system',
  'hiclaw-controller.hiclaw-system.svc',
  'hiclaw-controller.hiclaw-system.svc.cluster.local',
];

function readAuthTokenFromFile(path: string): string | undefined {
  try {
    // Use dynamic import so this code can still run in non-Node environments (e.g. tests)
    const fs = require('fs');
    return fs.readFileSync(path, 'utf-8').trim();
  } catch {
    return undefined;
  }
}

export function getAuthToken(): string | undefined {
  // Do NOT cache: projected service-account tokens rotate (e.g. every 3600s).
  // Re-read on every call so we never send a stale token to the controller.
  return (
    process.env.HICLAW_AUTH_TOKEN ||
    (process.env.HICLAW_AUTH_TOKEN_FILE
      ? readAuthTokenFromFile(process.env.HICLAW_AUTH_TOKEN_FILE)
      : undefined)
  );
}

function getDefaultControllerUrl(): string {
  // Default to the in-cluster service name so a missing env var does not
  // cause the dashboard to proxy to itself on localhost.
  return (
    process.env.HICLAW_CONTROLLER_URL ||
    process.env.HICLAW_API_URL ||
    'http://hiclaw-controller.hiclaw-system:8090'
  );
}

export function getControllerUrl(request: NextRequest): string {
  const defaultUrl = getDefaultControllerUrl();
  const url = request.nextUrl.searchParams.get('controllerUrl');
  if (url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
      if (
        !ALLOWED_HOSTS.includes(parsed.hostname) &&
        !parsed.hostname.endsWith('.svc') &&
        !parsed.hostname.endsWith('.svc.cluster.local') &&
        !parsed.hostname.endsWith('.cluster.local') &&
        !parsed.hostname.endsWith('.local')
      ) {
        throw new Error('Host not allowed');
      }
    } catch {
      // If validation fails, fall back to default
      return defaultUrl;
    }
    return url;
  }
  return defaultUrl;
}

export async function proxyToHiClaw(
  request: NextRequest,
  controllerUrl: string,
  path: string,
  options: {
    method?: string;
    forwardBody?: boolean;
    contentType?: string;
  } = {}
): Promise<NextResponse> {
  const { method = request.method, forwardBody = true, contentType } = options;
  const targetUrl = new URL(path, controllerUrl).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const fetchOptions: RequestInit = {
      method,
      signal: controller.signal,
      headers: {},
    };

    // In cluster mode the dashboard must authenticate to the controller using its
    // own service-account token. Prefer that over any browser-supplied Authorization.
    // Only fall back to the incoming header when no pod token is configured.
    const saToken = getAuthToken();
    const incomingAuth = request.headers.get('authorization');
    const authToken = saToken || (incomingAuth ? incomingAuth.replace(/^Bearer\s+/i, '') : undefined);
    if (authToken) {
      (fetchOptions.headers as Record<string, string>)['authorization'] = `Bearer ${authToken}`;
    }

    if (forwardBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (contentType === 'multipart/form-data') {
        // Forward multipart as-is (don't set Content-Type, let fetch handle boundary)
        const body = await request.arrayBuffer();
        fetchOptions.body = body;
        // Copy the content-type header from the original request
        const origCT = request.headers.get('content-type');
        if (origCT) {
          (fetchOptions.headers as Record<string, string>)['content-type'] = origCT;
        }
      } else {
        fetchOptions.body = await request.text();
        (fetchOptions.headers as Record<string, string>)['content-type'] = 'application/json';
      }
    }

    const res = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeout);

    // For 204 No Content
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await res.arrayBuffer();
    const responseHeaders = new Headers();
    const resCT = res.headers.get('content-type');
    if (resCT) responseHeaders.set('content-type', resCT);

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timeout'
      : err instanceof Error
        ? err.message
        : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
