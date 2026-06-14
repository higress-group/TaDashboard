'use client';

import { useState, useEffect, useRef } from 'react';

export function useCounter(end: number, duration = 1000): number {
  const [count, setCount] = useState(0);
  const prevEnd = useRef(0);

  useEffect(() => {
    if (end === prevEnd.current) return;
    const start = prevEnd.current;
    const diff = end - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let rafId: number;
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        prevEnd.current = end;
      }
    };
    rafId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafId);
      prevEnd.current = end;
    };
  }, [end, duration]);

  return count;
}
