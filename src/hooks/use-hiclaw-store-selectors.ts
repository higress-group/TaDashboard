'use client';

import { useShallow } from 'zustand/react/shallow';
import { useHiClawStore, type HiClawState } from '@/lib/hiclaw-store';

export function useIsConnected(): boolean {
  return useHiClawStore((s: HiClawState) => s.isConnected);
}

export function useConnectionMeta(): { isConnected: boolean; latency: number | null; lastConnectedAt: number | null } {
  return useHiClawStore(
    useShallow((s: HiClawState) => ({
      isConnected: s.isConnected,
      latency: s.connectionLatency,
      lastConnectedAt: s.lastConnectedAt,
    })),
  );
}

export function useSettingsDialog(): { open: boolean; onOpenChange: (next: boolean) => void } {
  return useHiClawStore(
    useShallow((s: HiClawState) => ({
      open: s.settingsOpen,
      onOpenChange: (next: boolean) => (next ? s.openSettings() : s.closeSettings()),
    })),
  );
}
