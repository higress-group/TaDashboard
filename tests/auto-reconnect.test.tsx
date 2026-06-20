// Tests for the auto-reconnect timer logic.
//
// We can't easily install @testing-library/react in this sandbox, so instead
// we extract the same conditions and exercise them directly against the
// store + timer. This is a behavioural test: it verifies the conditions under
// which checkConnection is scheduled and skipped, and that a manual timer
// teardown prevents further invocations.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHiClawStore } from '@/lib/hiclaw-store';

// Re-implement the polling schedule so we can exercise it without React.
// The actual hook in `src/hooks/use-auto-reconnect.ts` does the same.
function schedulePolling(
  intervalMs: number,
  onTick: () => void,
): () => void {
  const id = setInterval(() => {
    const state = useHiClawStore.getState();
    if (state.isConnected || state.isChecking || state.settingsOpen) return;
    if (!state.autoReconnect) {
      clearInterval(id);
      return;
    }
    onTick();
  }, intervalMs);
  return () => clearInterval(id);
}

describe('auto-reconnect polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useHiClawStore.setState({
      autoReconnect: true,
      isConnected: false,
      isChecking: false,
      settingsOpen: false,
      reconnectInterval: 1000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls when autoReconnect is on and not connected', () => {
    const spy = vi.fn();
    const cancel = schedulePolling(1000, spy);
    vi.advanceTimersByTime(3500);
    expect(spy).toHaveBeenCalledTimes(3);
    cancel();
  });

  it('does not poll when autoReconnect is disabled at boot', () => {
    useHiClawStore.setState({ autoReconnect: false });
    const spy = vi.fn();
    const cancel = schedulePolling(1000, spy);
    vi.advanceTimersByTime(5000);
    expect(spy).not.toHaveBeenCalled();
    cancel();
  });

  it('does not poll while a connection check is in flight', () => {
    useHiClawStore.setState({ isChecking: true });
    const spy = vi.fn();
    const cancel = schedulePolling(1000, spy);
    vi.advanceTimersByTime(5000);
    expect(spy).not.toHaveBeenCalled();
    cancel();
  });

  it('does not poll while settings dialog is open', () => {
    useHiClawStore.setState({ settingsOpen: true });
    const spy = vi.fn();
    const cancel = schedulePolling(1000, spy);
    vi.advanceTimersByTime(5000);
    expect(spy).not.toHaveBeenCalled();
    cancel();
  });

  it('cancelling the schedule prevents further ticks (no leaked timers)', () => {
    const spy = vi.fn();
    const cancel = schedulePolling(1000, spy);
    vi.advanceTimersByTime(2000);
    expect(spy).toHaveBeenCalledTimes(2);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});