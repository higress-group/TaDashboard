import { NextRequest, NextResponse } from 'next/server';
import { proxyToHiClaw, getControllerUrl } from '../proxy-helper';

export async function GET(request: NextRequest) {
  return proxyToHiClaw(request, getControllerUrl(request), '/healthz', {
    forwardBody: false,
  });
}

export const runtime = 'nodejs';