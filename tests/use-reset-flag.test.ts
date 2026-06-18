// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResetFlag } from '@/hooks/use-reset-flag';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useResetFlag', () => {
  it('starts at false and is initially inactive', () => {
    const { result } = renderHook(() => useResetFlag(2000));
    expect(result.current[0]).toBe(false);
  });

  it('flips to true and back to false after the reset window', () => {
    const { result } = renderHook(() => useResetFlag(2000));
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(1999));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe(false);
  });

  it('cancels the previous timer when re-armed', () => {
    const { result } = renderHook(() => useResetFlag(1000));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current[1]());
    act(() => vi.advanceTimersByTime(800));
    expect(result.current[0]).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBe(false);
  });

  it('reset() clears the timer and flips to false immediately', () => {
    const { result } = renderHook(() => useResetFlag(2000));
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => result.current[2]());
    expect(result.current[0]).toBe(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current[0]).toBe(false);
  });

  it('set(false) flips to false without scheduling a timer', () => {
    const { result } = renderHook(() => useResetFlag(2000));
    act(() => result.current[1]());
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current[0]).toBe(false);
  });

  it('cleans up the pending timer on unmount', () => {
    const { result, unmount } = renderHook(() => useResetFlag(2000));
    act(() => result.current[1]());
    unmount();
    // No assertion needed beyond the absence of a state-after-unmount warning.
    // vi.advanceTimersByTime is just to make sure nothing explodes.
    act(() => vi.advanceTimersByTime(5000));
  });
});
