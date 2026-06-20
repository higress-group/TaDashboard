import { describe, it, expect, beforeEach } from 'vitest';
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { SearchProvider, useSearch } from '@/lib/search-context';

describe('search-context', () => {
  it('returns default value when called outside provider (no provider in tree)', () => {
    // Default context value provides searchQuery='' and a no-op setSearchQuery,
    // so useSearch() outside a SearchProvider is well-defined and silent.
    const { result } = renderHook(() => useSearch());
    expect(result.current.searchQuery).toBe('');
    expect(typeof result.current.setSearchQuery).toBe('function');
  });

  it('returns initial empty state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <SearchProvider>{children}</SearchProvider>;
    const { result } = renderHook(() => useSearch(), { wrapper });
    expect(result.current.searchQuery).toBe('');
    expect(typeof result.current.setSearchQuery).toBe('function');
  });

  it('setSearchQuery updates the value', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <SearchProvider>{children}</SearchProvider>;
    const { result } = renderHook(() => useSearch(), { wrapper });
    act(() => result.current.setSearchQuery('hello'));
    expect(result.current.searchQuery).toBe('hello');
    act(() => result.current.setSearchQuery('world'));
    expect(result.current.searchQuery).toBe('world');
  });

  it('value identity is stable across unrelated re-renders (parent useState)', () => {
    let triggerRerender: () => void = () => {};
    function Wrapper({ children }: { children: React.ReactNode }) {
      const [, setTick] = useState(0);
      triggerRerender = () => setTick((t) => t + 1);
      return <SearchProvider>{children}</SearchProvider>;
    }
    const { result, rerender } = renderHook(() => useSearch(), { wrapper: Wrapper });
    const first = result.current;
    act(() => triggerRerender());
    rerender();
    // Identity should be preserved when searchQuery hasn't changed.
    expect(result.current).toBe(first);
  });

  it('value identity changes when searchQuery changes', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <SearchProvider>{children}</SearchProvider>;
    const { result } = renderHook(() => useSearch(), { wrapper });
    const first = result.current;
    act(() => result.current.setSearchQuery('changed'));
    expect(result.current).not.toBe(first);
    expect(result.current.searchQuery).toBe('changed');
  });
});
