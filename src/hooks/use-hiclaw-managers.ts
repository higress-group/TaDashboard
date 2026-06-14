import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { ManagerResponse } from '@/lib/hiclaw-api';

export function useManagers() {
  return useQuery<ManagerResponse[]>({
    queryKey: ['hiclaw-managers'],
    queryFn: () => hiclawApi.listManagers(),
    refetchInterval: 15000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
