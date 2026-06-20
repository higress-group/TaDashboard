import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';
import { useHiClawStore } from '@/lib/hiclaw-store';

export function useHiClawStatus() {
  return useQuery({
    queryKey: ['hiclaw-health'],
    queryFn: () => {
      const store = useHiClawStore.getState();
      return hiclawApi.checkHealth(store.controllerUrl);
    },
    refetchInterval: 15000,
    ...DEFAULT_QUERY_CONFIG,
    placeholderData: 'checking',
  });
}
