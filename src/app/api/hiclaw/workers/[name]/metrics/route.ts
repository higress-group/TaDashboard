import { NextRequest } from 'next/server';
import { getControllerUrl } from '../../../proxy-helper';
import { metricsForWorker } from '@/lib/worker-fallback';
import { proxyWorkerSubresourceOrFallback } from '../fallback-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return proxyWorkerSubresourceOrFallback(
    request,
    getControllerUrl(request),
    name,
    'metrics',
    metricsForWorker,
  );
}
