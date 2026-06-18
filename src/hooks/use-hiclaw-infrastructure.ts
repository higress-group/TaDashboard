import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import type { InfrastructureInfo } from '@/lib/hiclaw-api';

export function useInfrastructure() {
  return useQuery<InfrastructureInfo | null>({
    queryKey: ['hiclaw-infrastructure'],
    queryFn: () => hiclawApi.getInfrastructure(),
    refetchInterval: 30000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: (previousData) => previousData,
  });
}
