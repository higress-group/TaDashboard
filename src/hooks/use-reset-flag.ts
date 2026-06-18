'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Toggle a "transient" boolean flag (typically a "copied" confirmation)
 * for `resetMs` milliseconds, then flip it back to false. The timer is
 * stored in a ref so a mid-flight unmount does not produce a
 * "setState on unmounted component" warning; a single mount that
 * toggles repeatedly cancels the previous timer.
 *
 * Returns a 3-tuple: `[value, set, reset]`. `set(true)` arms the timer;
 * `reset()` cancels the timer and flips to false immediately.
 */
export function useResetFlag(resetMs: number = 2000): [boolean, (next?: boolean) => void, () => void] {
  const [value, setValue] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const set = useCallback(
    (next: boolean = true) => {
      clear();
      if (next) {
        setValue(true);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setValue(false);
        }, resetMs);
      } else {
        setValue(false);
      }
    },
    [clear, resetMs],
  );

  const reset = useCallback(() => {
    clear();
    setValue(false);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return [value, set, reset];
}
