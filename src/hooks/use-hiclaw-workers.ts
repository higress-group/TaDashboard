import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { WorkerResponse } from '@/lib/hiclaw-api';

export function useWorkers() {
  return useQuery<WorkerResponse[]>({
    queryKey: ['hiclaw-workers'],
    queryFn: () => hiclawApi.listWorkers(),
    refetchInterval: 15000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
