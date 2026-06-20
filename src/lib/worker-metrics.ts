import { ApiClientError } from './api-errors';
import { SYNTHETIC_METRICS_UPDATED_AT } from './worker-fallback';

export interface WorkerMetrics {
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
  updatedAt: string;
}

export function isSyntheticWorkerMetrics(metrics: WorkerMetrics | null | undefined): boolean {
  return metrics?.updatedAt === SYNTHETIC_METRICS_UPDATED_AT;
}

export async function fetchMetrics(name: string): Promise<WorkerMetrics | null> {
  const res = await fetch(`/api/hiclaw/workers/${encodeURIComponent(name)}/metrics`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await ApiClientError.fromResponse(res, 'hiclaw', `/workers/${name}/metrics`);
  }
  return (await res.json()) as WorkerMetrics;
}
