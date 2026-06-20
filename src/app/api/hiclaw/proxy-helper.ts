// Shared proxy helper for HiClaw API routes
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { jsonErrorBody, statusToCode, type ApiErrorBody } from '@/lib/api-errors';
import { isAllowedHiclawUrl } from '@/lib/url-allow-list';

const TIMEOUT_MS = 10000;

function readAuthTokenFromFile(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf-8').trim();
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
    if (!isAllowedHiclawUrl(url)) {
      // Host not on the allow-list; fall back to the configured default
      // rather than 400-ing, because the dashboard's main code path
      // (settings dialog, store updates) only ever sends env-derived URLs.
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

    // Normalize non-2xx responses into the standard error envelope
    if (!res.ok) {
      const text = new TextDecoder().decode(data);
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : text;
      } catch {
        // keep raw text
      }
      const code = statusToCode(res.status);
      const message =
        typeof parsed === "object" && parsed && "message" in parsed && typeof (parsed as { message?: unknown }).message === "string"
          ? (parsed as { message: string }).message
          : `HiClaw controller returned ${res.status}`;
      const body: ApiErrorBody = {
        error: {
          code,
          message,
          upstream: { service: "hiclaw", status: res.status, path },
          ...(parsed !== text ? { details: parsed } : {}),
        },
      };
      return NextResponse.json(body, { status: res.status });
    }

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout
      ? 'HiClaw controller request timed out'
      : err instanceof Error
        ? err.message
        : 'Unknown HiClaw controller error';
    const body = jsonErrorBody(isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE', message, {
      upstream: { service: 'hiclaw', path },
    });
    return NextResponse.json(body, { status: isTimeout ? 504 : 502 });
  }
}