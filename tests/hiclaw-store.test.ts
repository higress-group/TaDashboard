import { describe, it, expect, beforeEach } from 'vitest';
// @vitest-environment jsdom
import { useHiClawStore } from '@/lib/hiclaw-store';

describe('hiclaw store (synchronous setters only)', () => {
  beforeEach(() => {
    useHiClawStore.setState({
      controllerUrl: 'http://example:8090',
      isConnected: false,
      connectionError: null,
      isChecking: false,
      settingsOpen: false,
      autoReconnect: true,
      reconnectInterval: 15000,
      lastConnectedAt: null,
      connectionLatency: null,
      connectionHistory: [],
    });
  });

  it('setControllerUrl updates URL only', () => {
    useHiClawStore.getState().setControllerUrl('http://new:9000');
    expect(useHiClawStore.getState().controllerUrl).toBe('http://new:9000');
  });

  it('openSettings / closeSettings toggle the flag', () => {
    useHiClawStore.getState().openSettings();
    expect(useHiClawStore.getState().settingsOpen).toBe(true);
    useHiClawStore.getState().closeSettings();
    expect(useHiClawStore.getState().settingsOpen).toBe(false);
  });

  it('setAutoReconnect / setReconnectInterval update settings', () => {
    useHiClawStore.getState().setAutoReconnect(false);
    expect(useHiClawStore.getState().autoReconnect).toBe(false);
    useHiClawStore.getState().setReconnectInterval(30000);
    expect(useHiClawStore.getState().reconnectInterval).toBe(30000);
  });

  it('addConnectionAttempt prepends and caps at 5', () => {
    const add = useHiClawStore.getState().addConnectionAttempt;
    for (let i = 0; i < 8; i++) {
      add({
        timestamp: Date.now() + i,
        url: 'http://x',
        success: i % 2 === 0,
        latency: 100 + i,
        error: null,
      });
    }
    const hist = useHiClawStore.getState().connectionHistory;
    expect(hist).toHaveLength(5);
    expect(hist[0].latency).toBe(107);
    expect(hist[4].latency).toBe(103);
  });
});
