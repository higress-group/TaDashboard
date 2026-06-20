'use client';

import { useUiStore } from '@/lib/ui-store';

export interface UseModernChrome {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** True when the user has not yet seen the kill-switch notice this session. */
  hint: boolean;
}

export function useModernChrome(): UseModernChrome {
  const enabled = useUiStore((s) => s.modernChromeEnabled);
  const setEnabled = useUiStore((s) => s.setModernChromeEnabled);
  return { enabled, setEnabled, hint: enabled };
}