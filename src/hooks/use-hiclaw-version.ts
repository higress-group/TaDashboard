import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import type { VersionInfo } from '@/lib/hiclaw-api';

export function useVersion() {
  return useQuery<VersionInfo | null>({
    queryKey: ['hiclaw-version'],
    queryFn: () => hiclawApi.getVersion(),
    refetchInterval: 300000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: (previousData) => previousData,
  });
}
