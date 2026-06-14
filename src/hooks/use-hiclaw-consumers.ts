import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { ConsumerResponse } from '@/lib/hiclaw-api';

export function useConsumers() {
  return useQuery<ConsumerResponse[]>({
    queryKey: ['hiclaw-consumers'],
    queryFn: () => hiclawApi.listConsumers(),
    refetchInterval: 30000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
