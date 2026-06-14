import { NextRequest } from 'next/server';
import { getControllerUrl, proxyToHiClaw } from '../../../proxy-helper';

export async function POST(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return proxyToHiClaw(request, getControllerUrl(request), `/api/v1/workers/${encodeURIComponent(name)}/ensure-ready`, { forwardBody: false, method: 'POST' });
}
