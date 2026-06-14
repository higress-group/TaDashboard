import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { WorkerResponse } from '@/lib/hiclaw-api';

export function useWorkerDetail(name: string | undefined) {
  return useQuery<WorkerResponse | null>({
    queryKey: ['hiclaw-worker-detail', name],
    queryFn: () => hiclawApi.getWorker(name!),
    enabled: !!name,
    refetchInterval: 15000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
