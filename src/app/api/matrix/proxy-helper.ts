// Shared proxy helper for Matrix Client-Server API routes
import { NextRequest, NextResponse } from 'next/server';

const TIMEOUT_MS = 30000; // Matrix sync can take longer

export function getMatrixHomeserver(request: NextRequest): string {
  const url = request.nextUrl.searchParams.get('homeserver');
  if (!url) {
    throw new Error('Missing homeserver URL. Provide via ?homeserver= parameter.');
  }
  // Validate URL to prevent SSRF
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid homeserver protocol');
    }
  } catch {
    throw new Error('Invalid homeserver URL format');
  }
  return url;
}

export function getAccessToken(request: NextRequest): string {
  const token = request.nextUrl.searchParams.get('accessToken')
    || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    throw new Error('Missing access token. Provide via ?accessToken= parameter or Authorization header.');
  }
  return token;
}

export async function proxyToMatrix(
  request: NextRequest,
  homeserver: string,
  path: string,
  accessToken: string,
  options: {
    method?: string;
    forwardBody?: boolean;
    timeout?: number;
  } = {}
): Promise<NextResponse> {
  const { method = request.method, forwardBody = true, timeout = TIMEOUT_MS } = options;
  const targetUrl = `${homeserver}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      } as Record<string, string>,
    };

    if (forwardBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = await request.text();
    }

    const res = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);

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
    clearTimeout(timeoutId);
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Matrix request timeout'
      : err instanceof Error
        ? err.message
        : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
