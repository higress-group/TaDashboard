// POST /api/matrix/login - Login to Matrix homeserver
import { NextRequest, NextResponse } from 'next/server';
import { jsonErrorBody, jsonErrorResponse } from '@/lib/api-errors';
import { isAllowedMatrixHost } from '../proxy-helper';

export async function POST(request: NextRequest) {
  let body: { homeserver?: unknown; username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonErrorResponse('BAD_REQUEST', 'Body must be valid JSON');
  }

  const { homeserver, username, password } = body;

  if (typeof homeserver !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
    return jsonErrorResponse('BAD_REQUEST', 'Missing or invalid required fields: homeserver, username, password');
  }

  const check = isAllowedMatrixHost(homeserver);
  if (!check.ok) {
    return jsonErrorResponse('FORBIDDEN', check.error || 'Homeserver not allowed', {
      details: { host: (() => { try { return new URL(homeserver).hostname; } catch { return undefined; } })() },
    });
  }

  const loginUrl = `${homeserver}/_matrix/client/v3/login`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(loginUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: username,
        },
        password,
      }),
    });

    clearTimeout(timeout);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const upstreamMessage =
        typeof data === 'object' && data && 'error' in data
          ? String((data as { error?: unknown }).error)
          : 'Login failed';
      return NextResponse.json(
        jsonErrorBody('UPSTREAM_UNAVAILABLE', upstreamMessage, {
          upstream: { status: res.status, service: 'matrix', path: '/_matrix/client/v3/login' },
          details: data,
        }),
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout
      ? 'Matrix homeserver login timed out'
      : err instanceof Error
        ? err.message
        : 'Unknown Matrix homeserver error';
    return NextResponse.json(
      jsonErrorBody(isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE', message, {
        upstream: { service: 'matrix', path: '/_matrix/client/v3/login' },
      }),
      { status: isTimeout ? 504 : 502 }
    );
  }
}

export const runtime = 'nodejs';