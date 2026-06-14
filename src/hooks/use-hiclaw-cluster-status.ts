import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { ClusterStatus } from '@/lib/hiclaw-api';

const defaultStatus: ClusterStatus = { kubeMode: false, totalWorkers: 0, totalTeams: 0, totalHumans: 0 };

export function useClusterStatus() {
  return useQuery<ClusterStatus>({
    queryKey: ['hiclaw-cluster-status'],
    queryFn: () => hiclawApi.getStatus(),
    refetchInterval: 15000,
    retry: 1,
    placeholderData: (previousData) => previousData ?? defaultStatus,
    throwOnError: false,
  });
}
