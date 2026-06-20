// PUT /api/matrix/rooms/[roomId]/typing - Publish Matrix `m.typing`
// ephemeral event. R1-1: throttled client-side; the route is a
// best-effort forwarder.
import { NextRequest, NextResponse } from 'next/server';
import { getMatrixHomeserver, getAccessToken } from '../../../proxy-helper';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const homeserver = getMatrixHomeserver(request);
    const accessToken = getAccessToken(request);

    const encodedRoomId = encodeURIComponent(roomId);
    const targetUrl = `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/typing`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl, {
      method: 'PUT',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ timeout: 30000 }),
    });

    clearTimeout(timeout);
    return new NextResponse(null, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}