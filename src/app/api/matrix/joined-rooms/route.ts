// GET /api/matrix/joined-rooms - List joined rooms
import { NextRequest, NextResponse } from 'next/server';
import { getMatrixHomeserver, getAccessToken, proxyToMatrix } from '../proxy-helper';

export async function GET(request: NextRequest) {
  try {
    const homeserver = getMatrixHomeserver(request);
    const accessToken = getAccessToken(request);
    return await proxyToMatrix(request, homeserver, '/_matrix/client/v3/joined_rooms', accessToken, {
      method: 'GET',
      forwardBody: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
