import { NextRequest } from 'next/server';
import { getControllerUrl, proxyToHiClaw } from '../../../proxy-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return proxyToHiClaw(request, getControllerUrl(request), `/api/v1/workers/${encodeURIComponent(name)}/status`, { forwardBody: false });
}
