import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { InfrastructureInfo } from '@/lib/hiclaw-api';

export function useInfrastructure() {
  return useQuery<InfrastructureInfo | null>({
    queryKey: ['hiclaw-infrastructure'],
    queryFn: () => hiclawApi.getInfrastructure(),
    refetchInterval: 30000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
