// GET /api/matrix/rooms/[roomId]/members - Get room members
import { NextRequest, NextResponse } from 'next/server';
import { getMatrixHomeserver, getAccessToken, proxyToMatrix } from '../../../proxy-helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const homeserver = getMatrixHomeserver(request);
    const accessToken = getAccessToken(request);

    const encodedRoomId = encodeURIComponent(roomId);
    const path = `/_matrix/client/v3/rooms/${encodedRoomId}/members`;

    return await proxyToMatrix(request, homeserver, path, accessToken, {
      method: 'GET',
      forwardBody: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
