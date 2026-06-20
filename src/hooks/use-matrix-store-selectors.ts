'use client';

import { useShallow } from 'zustand/react/shallow';
import { useMatrixStore, type MatrixState } from '@/lib/matrix-store';

export function useMatrixConnectionParams(): {
  homeserver: string;
  accessToken: string;
  isLoggedIn: boolean;
} {
  return useMatrixStore(
    useShallow((s: MatrixState) => ({
      homeserver: s.homeserver,
      accessToken: s.accessToken,
      isLoggedIn: s.isLoggedIn,
    })),
  );
}
