import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import type { ManagerResponse } from '@/lib/hiclaw-api';

export function useManagers() {
  return useQuery<ManagerResponse[]>({
    queryKey: ['hiclaw-managers'],
    queryFn: () => hiclawApi.listManagers(),
    refetchInterval: 15000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: (previousData) => previousData,
  });
}
