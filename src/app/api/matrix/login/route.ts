// POST /api/matrix/login - Login to Matrix homeserver
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeserver, username, password } = body;

    if (!homeserver || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: homeserver, username, password' },
        { status: 400 }
      );
    }

    // Validate homeserver URL to prevent SSRF
    try {
      const parsed = new URL(homeserver);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ error: 'Invalid homeserver protocol' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid homeserver URL' }, { status: 400 });
    }

    const loginUrl = `${homeserver}/_matrix/client/v3/login`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || data.errmsg || 'Login failed', code: data.errcode },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
