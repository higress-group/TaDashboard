'use client';

import { type ComponentType, type ReactNode } from 'react';
import { useModernChrome, ModernChromeFallback } from './index';

interface SectionWithChromeProps {
  /** Original section component. */
  legacy: ComponentType;
  /** Modern section component. */
  modern: ComponentType;
  /** Migration label used in the legacy fallback. */
  label: string;
  /** Optional: an explicit modern title/eyebrow slot when modern exists. */
  modernHeader?: ReactNode;
}

/**
 * Renders the modern section when the user has enabled
 * `modernChromeEnabled`; otherwise renders the legacy section
 * wrapped in a `ModernChromeFallback` notice. The flag is read via
 * `useModernChrome`, which sources from `useUiStore` (R7-1).
 */
export function SectionWithChrome({ legacy, modern, label, modernHeader }: SectionWithChromeProps) {
  const { enabled } = useModernChrome();
  if (enabled) {
    const Modern = modern;
    return (
      <div className="space-y-3">
        {modernHeader}
        <Modern />
      </div>
    );
  }
  const Legacy = legacy;
  return (
    <ModernChromeFallback reason={`${label} not migrated — using legacy chrome`}>
      <Legacy />
    </ModernChromeFallback>
  );
}