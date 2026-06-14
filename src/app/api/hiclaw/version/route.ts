import { NextRequest } from 'next/server';
import { getControllerUrl, proxyToHiClaw } from '../proxy-helper';

export async function GET(request: NextRequest) {
  return proxyToHiClaw(request, getControllerUrl(request), '/api/v1/version', { forwardBody: false });
}
