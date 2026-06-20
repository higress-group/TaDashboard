import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UiState {
  modernChatEnabled: boolean;
  modernChromeEnabled: boolean;
  setModernChatEnabled: (v: boolean) => void;
  setModernChromeEnabled: (v: boolean) => void;
}

const STORAGE_KEY = 'tadashboard.ui.v1';

function createStorage() {
  if (typeof window === 'undefined') {
    return createJSONStorage(() => ({
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    }));
  }
  try {
    const probe = '__tadashboard_ui_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    return createJSONStorage(() => ({
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    }));
  }
  return createJSONStorage(() => window.localStorage);
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      modernChatEnabled: true,
      modernChromeEnabled: true,
      setModernChatEnabled: (v) => set({ modernChatEnabled: v }),
      setModernChromeEnabled: (v) => set({ modernChromeEnabled: v }),
    }),
    {
      name: STORAGE_KEY,
      storage: createStorage(),
      version: 1,
      // On corrupt JSON, fall back to defaults rather than crashing.
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        return { ...current, ...persisted } as UiState;
      },
    },
  ),
);