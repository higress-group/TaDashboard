import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import type { WorkerResponse } from '@/lib/hiclaw-api';

export function useWorkers() {
  return useQuery<WorkerResponse[]>({
    queryKey: ['hiclaw-workers'],
    queryFn: () => hiclawApi.listWorkers(),
    refetchInterval: 15_000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: (previousData) => previousData,
  });
}
