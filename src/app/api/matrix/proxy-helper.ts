// Shared proxy helper for Matrix Client-Server API routes
import { NextRequest, NextResponse } from 'next/server';
import { jsonErrorBody, statusToCode, type ApiErrorBody } from '@/lib/api-errors';
import { isAllowedMatrixUrl } from '@/lib/url-allow-list';

const TIMEOUT_MS = 30000; // Matrix sync can take longer

export function isAllowedMatrixHost(url: string): { ok: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'Invalid homeserver URL format' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, error: 'Invalid homeserver protocol' };
  }
  if (!isAllowedMatrixUrl(url)) {
    return { ok: false, error: 'Homeserver host not allowed' };
  }
  return { ok: true };
}

export function getMatrixHomeserver(request: NextRequest): string {
  const url = request.nextUrl.searchParams.get('homeserver');
  if (!url) {
    throw new Error('Missing homeserver URL. Provide via ?homeserver= parameter.');
  }
  const result = isAllowedMatrixHost(url);
  if (!result.ok) {
    throw new Error(result.error);
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

    if (!res.ok) {
      const text = new TextDecoder().decode(data);
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : text;
      } catch {
        // keep raw text
      }
      const code = statusToCode(res.status);
      const matrixMessage =
        typeof parsed === "object" && parsed && "error" in parsed
          ? String((parsed as { error?: unknown }).error)
          : `Matrix homeserver returned ${res.status}`;
      const body: ApiErrorBody = jsonErrorBody(
        code,
        matrixMessage || `Matrix homeserver returned ${res.status}`,
        {
          upstream: { service: "matrix", status: res.status, path },
          ...(parsed !== text ? { details: parsed } : {}),
        },
      );
      return NextResponse.json(body, { status: res.status });
    }

    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout
      ? 'Matrix homeserver request timed out'
      : err instanceof Error
        ? err.message
        : 'Unknown Matrix homeserver error';
    const body = jsonErrorBody(isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE', message, {
      upstream: { service: 'matrix', path },
    });
    return NextResponse.json(body, { status: isTimeout ? 504 : 502 });
  }
}
