import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { HumanResponse } from '@/lib/hiclaw-api';

export function useHumans() {
  return useQuery<HumanResponse[]>({
    queryKey: ['hiclaw-humans'],
    queryFn: () => hiclawApi.listHumans(),
    refetchInterval: 15000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
