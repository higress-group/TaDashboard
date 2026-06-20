import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { matrixApi } from './matrix-api';

export type MatrixTokenPersist = 'session' | 'local' | 'none';

const PERSIST_VALUES: MatrixTokenPersist[] = ['session', 'local', 'none'];

// Default to 'none' to minimise token persistence surface. Operators who
// accept the XSS risk can opt in via NEXT_PUBLIC_MATRIX_TOKEN_PERSIST.
function resolvePersistMode(): MatrixTokenPersist {
  if (typeof process === 'undefined') return 'none';
  const raw = (process.env.NEXT_PUBLIC_MATRIX_TOKEN_PERSIST || 'none').toLowerCase();
  return PERSIST_VALUES.includes(raw as MatrixTokenPersist)
    ? (raw as MatrixTokenPersist)
    : 'none';
}

// Maximum age before a stored token is considered stale and discarded.
// Operators can override via NEXT_PUBLIC_MATRIX_TOKEN_MAX_AGE_MS (in ms).
function resolveTokenMaxAge(): number {
  if (typeof process === 'undefined') return 8 * 60 * 60 * 1000; // 8h
  const raw = process.env.NEXT_PUBLIC_MATRIX_TOKEN_MAX_AGE_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 8 * 60 * 60 * 1000;
  return parsed;
}

function createMatrixStorage(persistMode: MatrixTokenPersist) {
  if (persistMode === 'none') {
    return createJSONStorage(() => ({
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    }));
  }
  const backend = persistMode === 'session' ? 'sessionStorage' : 'localStorage';
  return createJSONStorage(() => {
    if (typeof window === 'undefined') {
      // SSR safe fallback; Zustand persist hydrates on the client.
      return {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      };
    }
    return window[backend];
  });
}

export function __testing_createMatrixStorage(persistMode: MatrixTokenPersist) {
  return createMatrixStorage(persistMode);
}

export interface MatrixState {
  // Connection
  homeserver: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  tokenIssuedAt: number;          // Date.now() at login; used to expire stale tokens
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
  // Validate the stored token against the homeserver. If 401, force logout.
  // Returns true if the token is still valid (or could not be checked).
  validateStoredToken: () => Promise<boolean>;
}

const persistMode = resolvePersistMode();
const tokenMaxAgeMs = resolveTokenMaxAge();

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      homeserver: '',
      accessToken: '',
      userId: '',
      deviceId: '',
      tokenIssuedAt: 0,
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
            tokenIssuedAt: Date.now(),
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
          tokenIssuedAt: 0,
          isLoggedIn: false,
          loginError: null,
          syncToken: null,
          isSyncing: false,
        });
      },

      setHomeserver: (url: string) => set({ homeserver: url }),
      setSyncToken: (token: string | null) => set({ syncToken: token }),
      setSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

      validateStoredToken: async () => {
        const state = get();
        if (!state.isLoggedIn || !state.accessToken || !state.homeserver) {
          return false;
        }
        // Discard stale tokens by age without a round trip.
        if (state.tokenIssuedAt > 0 && Date.now() - state.tokenIssuedAt > tokenMaxAgeMs) {
          get().logout();
          return false;
        }
        // Probe the homeserver. 401 means the token was revoked server-side.
        try {
          await matrixApi.getJoinedRooms(state.homeserver, state.accessToken);
          return true;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
            get().logout();
            return false;
          }
          // Network / upstream failure: don't punish the user, assume still valid.
          return true;
        }
      },
    }),
    {
      name: 'matrix-store',
      storage: createMatrixStorage(persistMode),
      partialize: (state) => ({
        homeserver: state.homeserver,
        accessToken: state.accessToken,
        userId: state.userId,
        deviceId: state.deviceId,
        tokenIssuedAt: state.tokenIssuedAt,
        isLoggedIn: state.isLoggedIn,
        syncToken: state.syncToken,
      }),
      // Bump version when changing partialize shape so old storage entries are discarded.
      version: 3,
      // After rehydrate, run a token-validity probe.
      onRehydrateStorage: () => (state) => {
        if (state?.isLoggedIn && typeof window !== 'undefined') {
          // Fire-and-forget; logout happens inside if validation fails.
          void state.validateStoredToken();
        }
      },
    }
  )
);

export {
  persistMode as MATRIX_TOKEN_PERSIST_MODE,
  tokenMaxAgeMs as MATRIX_TOKEN_MAX_AGE_MS,
};