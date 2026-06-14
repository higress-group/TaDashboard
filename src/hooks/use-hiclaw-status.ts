import { useQuery } from '@tanstack/react-query';
import { hiclawApi } from '@/lib/hiclaw-api';
import { useHiClawStore } from '@/lib/hiclaw-store';

export function useHiClawStatus() {
  return useQuery({
    queryKey: ['hiclaw-health'],
    queryFn: () => {
      const store = useHiClawStore.getState();
      return hiclawApi.checkHealth(store.controllerUrl);
    },
    refetchInterval: 15000,
    retry: 1,
    placeholderData: 'checking',
    throwOnError: false,
  });
}
