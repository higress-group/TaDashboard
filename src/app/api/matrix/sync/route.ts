// GET /api/matrix/sync - Matrix sync endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getMatrixHomeserver, getAccessToken, proxyToMatrix } from '../proxy-helper';

export async function GET(request: NextRequest) {
  try {
    const homeserver = getMatrixHomeserver(request);
    const accessToken = getAccessToken(request);

    const since = request.nextUrl.searchParams.get('since') || '';
    const rawTimeout = parseInt(request.nextUrl.searchParams.get('timeout') || '30000', 10);
    // Clamp timeout to prevent DoS (0-60000ms)
    const timeout = Number.isFinite(rawTimeout) ? String(Math.max(0, Math.min(rawTimeout, 60000))) : '30000';
    const filter = request.nextUrl.searchParams.get('filter') || '';

    let path = `/_matrix/client/v3/sync?timeout=${timeout}`;
    if (since) path += `&since=${encodeURIComponent(since)}`;
    if (filter) path += `&filter=${encodeURIComponent(filter)}`;

    return await proxyToMatrix(request, homeserver, path, accessToken, {
      method: 'GET',
      forwardBody: false,
      timeout: 60000, // Long polling can take up to 60s
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
