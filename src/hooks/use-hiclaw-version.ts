import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import type { VersionInfo } from '@/lib/hiclaw-api';

export function useVersion() {
  return useQuery<VersionInfo | null>({
    queryKey: ['hiclaw-version'],
    queryFn: () => hiclawApi.getVersion(),
    refetchInterval: 300000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });
}
