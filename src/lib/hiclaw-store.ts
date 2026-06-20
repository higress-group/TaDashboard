import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApiErrorCode } from './api-errors';

export interface ConnectionAttempt {
  timestamp: number;
  url: string;
  success: boolean;
  latency: number | null;
  error: string | null;
}

export interface ConnectionErrorInfo {
  code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
}

export interface HiClawState {
  controllerUrl: string;
  isConnected: boolean;
  connectionError: ConnectionErrorInfo | null;
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

async function readErrorInfo(res: Response, fallback: string): Promise<ConnectionErrorInfo> {
  try {
    const payload = await res.clone().json();
    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof (payload.error as { code?: unknown }).code === 'string'
    ) {
      const err = payload.error as { code: string; message?: string };
      return {
        code: err.code as ApiErrorCode,
        message: typeof err.message === 'string' ? err.message : fallback,
      };
    }
  } catch {
    // fall through to default
  }
  return { code: 'UNKNOWN', message: fallback };
}

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
          const info = await readErrorInfo(res, '连接失败');
          const attempt: ConnectionAttempt = {
            timestamp: Date.now(),
            url,
            success: false,
            latency,
            error: info.message,
          };
          const history = [attempt, ...get().connectionHistory].slice(0, MAX_HISTORY);
          set({ isConnected: false, connectionError: info, isChecking: false, connectionHistory: history });
          return false;
        } catch (err) {
          const latency = Math.round(performance.now() - start);
          const message = err instanceof Error ? err.message : '连接失败';
          const info: ConnectionErrorInfo = {
            code: 'NETWORK_ERROR',
            message,
          };
          const attempt: ConnectionAttempt = {
            timestamp: Date.now(),
            url,
            success: false,
            latency,
            error: message,
          };
          const history = [attempt, ...get().connectionHistory].slice(0, MAX_HISTORY);
          set({ isConnected: false, connectionError: info, isChecking: false, connectionHistory: history });
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