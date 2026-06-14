import { NextRequest } from 'next/server';
import { getControllerUrl, proxyToHiClaw } from '../../../../proxy-helper';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToHiClaw(request, getControllerUrl(request), `/api/v1/gateway/consumers/${encodeURIComponent(id)}/bind`, { forwardBody: false, method: 'POST' });
}
