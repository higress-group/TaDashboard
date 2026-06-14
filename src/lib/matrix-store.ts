import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { matrixApi } from './matrix-api';

interface MatrixState {
  // Connection
  homeserver: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  loginError: string | null;

  // Sync
  syncToken: string | null;
  isSyncing: boolean;

  // Actions
  login: (homeserver: string, username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setHomeserver: (url: string) => void;
  setSyncToken: (token: string | null) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      homeserver: '',
      accessToken: '',
      userId: '',
      deviceId: '',
      isLoggedIn: false,
      isLoggingIn: false,
      loginError: null,
      syncToken: null,
      isSyncing: false,

      login: async (homeserver: string, username: string, password: string) => {
        set({ isLoggingIn: true, loginError: null });
        try {
          const result = await matrixApi.login(homeserver, username, password);
          set({
            homeserver,
            accessToken: result.access_token,
            userId: result.user_id,
            deviceId: result.device_id,
            isLoggedIn: true,
            isLoggingIn: false,
            loginError: null,
            syncToken: null,
          });
          return true;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({
            isLoggingIn: false,
            loginError: message,
            isLoggedIn: false,
          });
          return false;
        }
      },

      logout: () => {
        set({
          accessToken: '',
          userId: '',
          deviceId: '',
          isLoggedIn: false,
          loginError: null,
          syncToken: null,
          isSyncing: false,
        });
      },

      setHomeserver: (url: string) => set({ homeserver: url }),
      setSyncToken: (token: string | null) => set({ syncToken: token }),
      setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),
    }),
    {
      name: 'matrix-store',
      partialize: (state) => ({
        homeserver: state.homeserver,
        accessToken: state.accessToken,
        userId: state.userId,
        deviceId: state.deviceId,
        isLoggedIn: state.isLoggedIn,
        syncToken: state.syncToken,
      }),
    }
  )
);
