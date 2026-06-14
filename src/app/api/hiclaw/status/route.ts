import { NextRequest, NextResponse } from 'next/server';
import { getControllerUrl, proxyToHiClaw } from '../proxy-helper';

// GET /api/hiclaw/status - Controller 依赖健康检查
// 用于 Kubernetes readinessProbe，探测后端 Controller 是否可达。
export async function GET(request: NextRequest) {
  const controllerUrl = getControllerUrl(request);
  const res = await proxyToHiClaw(request, controllerUrl, '/healthz', { forwardBody: false });

  if (!res.ok) {
    return NextResponse.json(
      { status: 'unhealthy', controllerUrl },
      { status: 502 }
    );
  }

  const text = await res.text().catch(() => '');
  return new NextResponse(text, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
