'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchWorkerEvents, type WorkerEventsResponse } from '@/lib/worker-events';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';

export interface UseWorkerEventsOptions {
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useWorkerEvents(name: string | null, options: UseWorkerEventsOptions = {}) {
  const { refetchInterval = 5_000, enabled = true } = options;
  return useQuery<WorkerEventsResponse | null>({
    queryKey: ['worker-events', name],
    queryFn: () => fetchWorkerEvents(name ?? ''),
    enabled: enabled && !!name,
    refetchInterval,
    ...DEFAULT_QUERY_CONFIG,
    staleTime: typeof refetchInterval === 'number' ? Math.min(refetchInterval, 10_000) : 10_000,
  });
}
