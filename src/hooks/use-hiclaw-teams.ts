import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import type { TeamResponse } from '@/lib/hiclaw-api';

export function useTeams() {
  return useQuery<TeamResponse[]>({
    queryKey: ['hiclaw-teams'],
    queryFn: () => hiclawApi.listTeams(),
    refetchInterval: 15_000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: (previousData) => previousData,
  });
}
