import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import type { ConsumerResponse } from '@/lib/hiclaw-api';

export function useConsumers() {
  return useQuery<ConsumerResponse[]>({
    queryKey: ['hiclaw-consumers'],
    queryFn: () => hiclawApi.listConsumers(),
    refetchInterval: 30000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: (previousData) => previousData,
  });
}
