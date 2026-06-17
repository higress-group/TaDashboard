'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMetrics, type WorkerMetrics } from '@/lib/worker-metrics';

export interface UseWorkerMetricsOptions {
  /** Polling interval in ms; `false` disables polling. */
  refetchInterval?: number | false;
}

/**
 * React Query wrapper for `fetchMetrics`. Decouples list (30s) and
 * detail dialog (10s) consumers via independent `queryKey` segments
 * — same instance returns cached data without re-fetching.
 */
export function useWorkerMetrics(name: string | null, options: UseWorkerMetricsOptions = {}) {
  const { refetchInterval = 30_000 } = options;
  return useQuery<WorkerMetrics | null>({
    queryKey: ['worker-metrics', name],
    queryFn: () => fetchMetrics(name ?? ''),
    enabled: !!name,
    refetchInterval,
    retry: 1,
    staleTime: 10_000,
  });
}
