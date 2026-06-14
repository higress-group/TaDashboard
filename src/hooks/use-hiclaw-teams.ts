import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { TeamResponse } from '@/lib/hiclaw-api';

export function useTeams() {
  return useQuery<TeamResponse[]>({
    queryKey: ['hiclaw-teams'],
    queryFn: () => hiclawApi.listTeams(),
    refetchInterval: 15000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
