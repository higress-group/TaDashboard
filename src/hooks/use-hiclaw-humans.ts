import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import type { HumanResponse } from '@/lib/hiclaw-api';

export function useHumans() {
  return useQuery<HumanResponse[]>({
    queryKey: ['hiclaw-humans'],
    queryFn: () => hiclawApi.listHumans(),
    refetchInterval: 15000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: (previousData) => previousData,
  });
}
