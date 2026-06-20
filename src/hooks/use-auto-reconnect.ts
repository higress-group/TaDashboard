'use client';

import { useEffect } from 'react';
import { useHiClawStore } from '@/lib/hiclaw-store';

/**
 * Manages the auto-reconnect interval inside a React lifecycle.
 *
 * Previously the auto-reconnect logic ran as a module-level `useHiClawStore.subscribe`
 * callback. That worked but meant the timer was started on first import in the
 * browser and never tied to the React tree — leaving leaked timers after route
 * changes and being fragile under React StrictMode double-invocation.
 *
 * Mount this hook once near the top of the dashboard tree. The returned
 * `useEffect` cleanup clears the interval on unmount, and re-subscribes when
 * `reconnectInterval` changes.
 */
export function useAutoReconnect(): void {
  const autoReconnect = useHiClawStore((s) => s.autoReconnect);
  const reconnectInterval = useHiClawStore((s) => s.reconnectInterval);
  const checkConnection = useHiClawStore((s) => s.checkConnection);

  useEffect(() => {
    if (!autoReconnect) return undefined;

    const id = setInterval(() => {
      const state = useHiClawStore.getState();
      if (state.isConnected || state.isChecking || state.settingsOpen) return;
      void checkConnection();
    }, reconnectInterval);

    return () => clearInterval(id);
  }, [autoReconnect, reconnectInterval, checkConnection]);
}