import { describe, it, expect } from 'vitest';
import { DEFAULT_QUERY_CONFIG } from '@/lib/query-config';

describe('DEFAULT_QUERY_CONFIG', () => {
  it('uses 10s staleTime', () => {
    expect(DEFAULT_QUERY_CONFIG.staleTime).toBe(10_000);
  });

  it('retries once on failure', () => {
    expect(DEFAULT_QUERY_CONFIG.retry).toBe(1);
  });

  it('does not refetch on window focus', () => {
    expect(DEFAULT_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
  });

  it('does not poll in background', () => {
    expect(DEFAULT_QUERY_CONFIG.refetchIntervalInBackground).toBe(false);
  });

  it('swallows errors (does not throw to error boundaries)', () => {
    expect(DEFAULT_QUERY_CONFIG.throwOnError).toBe(false);
  });

  it('has exactly 5 keys (no accidental leaks)', () => {
    expect(Object.keys(DEFAULT_QUERY_CONFIG).sort()).toEqual([
      'refetchIntervalInBackground',
      'refetchOnWindowFocus',
      'retry',
      'staleTime',
      'throwOnError',
    ]);
  });
});
