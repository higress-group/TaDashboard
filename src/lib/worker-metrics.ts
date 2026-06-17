import { ApiClientError } from './api-errors';

export interface WorkerMetrics {
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
  updatedAt: string;
}

/**
 * Fetch worker resource metrics from the HiClaw controller.
 * Returns null when the controller does not yet expose a metrics
 * endpoint (HTTP 404), letting UI degrade gracefully to "–" placeholders.
 */
export async function fetchMetrics(name: string): Promise<WorkerMetrics | null> {
  const res = await fetch(`/api/hiclaw/workers/${encodeURIComponent(name)}/metrics`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await ApiClientError.fromResponse(res, 'hiclaw', `/workers/${name}/metrics`);
  }
  return (await res.json()) as WorkerMetrics;
}
