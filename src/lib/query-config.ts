import type { QueryObserverOptions } from '@tanstack/react-query';

export const DEFAULT_QUERY_CONFIG = {
  staleTime: 10_000,
  retry: 1,
  refetchOnWindowFocus: false,
  refetchIntervalInBackground: false,
  throwOnError: false,
} as const satisfies Pick<
  QueryObserverOptions<unknown, Error, unknown, unknown, readonly unknown[]>,
  'staleTime' | 'retry' | 'refetchOnWindowFocus' | 'refetchIntervalInBackground' | 'throwOnError'
>;
