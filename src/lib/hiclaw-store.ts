import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ConnectionAttempt {
  timestamp: number;
  url: string;
  success: boolean;
  latency: number | null;
  error: string | null;
}

interface HiClawState {
  controllerUrl: string;
  isConnected: boolean;
  connectionError: string | null;
  isChecking: boolean;
  settingsOpen: boolean;
  autoReconnect: boolean;
  reconnectInterval: number;
  lastConnectedAt: number | null;
  connectionLatency: number | null;
  connectionHistory: ConnectionAttempt[];

  setControllerUrl: (url: string) => void;
  checkConnection: () => Promise<boolean>;
  openSettings: () => void;
  closeSettings: () => void;
  setAutoReconnect: (val: boolean) => void;
  setReconnectInterval: (ms: number) => void;
  addConnectionAttempt: (attempt: ConnectionAttempt) => void;
}

const MAX_HISTORY = 5;

export const useHiClawStore = create<HiClawState>()(
  persist(
    (set, get) => ({
      controllerUrl:
        process.env.NEXT_PUBLIC_HICLAW_CONTROLLER_URL ||
        'http://hiclaw-controller.hiclaw-system:8090',
      isConnected: false,
      connectionError: null,
      isChecking: false,
      settingsOpen: false,
      autoReconnect: true,
      reconnectInterval: 15000,
      lastConnectedAt: null,
      connectionLatency: null,
      connectionHistory: [],

      setControllerUrl: (url: string) => {
        set({ controllerUrl: url });
      },

      checkConnection: async () => {
        set({ isChecking: true, connectionError: null });
        const url = get().controllerUrl;
        const start = performance.now();
        try {
          const res = await fetch(`/api/hiclaw/healthz?controllerUrl=${encodeURIComponent(url)}`);
          const latency = Math.round(performance.now() - start);
          if (res.ok) {
            const text = await res.text();
            if (text.trim() === 'ok') {
              const attempt: ConnectionAttempt = {
                timestamp: Date.now(),
                url,
                success: true,
                latency,
                error: null,
              };
              const history = [attempt, ...get().connectionHistory].slice(0, MAX_HISTORY);
              set({
                isConnected: true,
                connectionError: null,
                isChecking: false,
                lastConnectedAt: Date.now(),
                connectionLatency: latency,
                connectionHistory: history,
              });
              return true;
            }
          }
          const attempt: ConnectionAttempt = {
            timestamp: Date.now(),
            url,
            success: false,
            latency,
            error: '连接失败',
          };
          const history = [attempt, ...get().connectionHistory].slice(0, MAX_HISTORY);
          set({ isConnected: false, connectionError: '连接失败', isChecking: false, connectionHistory: history });
          return false;
        } catch (err) {
          const latency = Math.round(performance.now() - start);
          const message = err instanceof Error ? err.message : '连接失败';
          const attempt: ConnectionAttempt = {
            timestamp: Date.now(),
            url,
            success: false,
            latency,
            error: message,
          };
          const history = [attempt, ...get().connectionHistory].slice(0, MAX_HISTORY);
          set({ isConnected: false, connectionError: message, isChecking: false, connectionHistory: history });
          return false;
        }
      },

      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),

      setAutoReconnect: (val: boolean) => {
        set({ autoReconnect: val });
      },

      setReconnectInterval: (ms: number) => {
        set({ reconnectInterval: ms });
      },

      addConnectionAttempt: (attempt: ConnectionAttempt) => {
        const history = [attempt, ...get().connectionHistory].slice(0, MAX_HISTORY);
        set({ connectionHistory: history });
      },
    }),
    {
      name: 'hiclaw-store',
      partialize: (state) => ({
        controllerUrl: state.controllerUrl,
        autoReconnect: state.autoReconnect,
        reconnectInterval: state.reconnectInterval,
        lastConnectedAt: state.lastConnectedAt,
      }),
    }
  )
);

// Global auto-reconnect effect - subscribes to store and manages interval outside React
let reconnectTimer: ReturnType<typeof setInterval> | null = null;

function startAutoReconnect() {
  stopAutoReconnect();
  const { reconnectInterval, isConnected, isChecking, settingsOpen } = useHiClawStore.getState();
  
  // Don't start if already connected, currently checking, or settings open
  if (isConnected || isChecking || settingsOpen) return;

  reconnectTimer = setInterval(() => {
    const state = useHiClawStore.getState();
    // Only attempt if auto-reconnect is on, not connected, not checking, and settings not open
    if (state.autoReconnect && !state.isConnected && !state.isChecking && !state.settingsOpen) {
      state.checkConnection();
    } else if (state.isConnected || !state.autoReconnect) {
      // Stop if connected or auto-reconnect disabled
      stopAutoReconnect();
    }
  }, reconnectInterval);
}

function stopAutoReconnect() {
  if (reconnectTimer !== null) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
}

// Subscribe to store changes to manage auto-reconnect.
// Guard with window check so this does not run during SSR / Next.js build.
if (typeof window !== 'undefined') {
  useHiClawStore.subscribe((state, prevState) => {
  const shouldReconnect = state.autoReconnect && !state.isConnected && !state.settingsOpen;
  const wasReconnecting = prevState.autoReconnect && !prevState.isConnected && !prevState.settingsOpen;

  if (shouldReconnect && !wasReconnecting) {
    // Disconnected or autoReconnect turned on or settings closed
    startAutoReconnect();
  } else if (!shouldReconnect && wasReconnecting) {
    // Connected or autoReconnect turned off or settings opened
    stopAutoReconnect();
  }
  
  // If reconnectInterval changed while reconnecting, restart with new interval
  if (state.reconnectInterval !== prevState.reconnectInterval && shouldReconnect) {
    startAutoReconnect();
  }
  });
}
