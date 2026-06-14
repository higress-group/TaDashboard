import { NextResponse } from 'next/server';

// 轻量级本地健康检查，仅确认 Next.js 进程存活。
// 用于 Kubernetes livenessProbe；不依赖后端 Controller。
export async function GET() {
  return new NextResponse('ok', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
