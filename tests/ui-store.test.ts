/**
 * Interface contract tests for `src/lib/ui-store.ts`.
 *
 * These tests drive the public API of the new ui-store. They will fail
 * until the store is implemented, which is intentional — the contract
 * is the spec, and we want CI to flag any drift.
 */

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useUiStore (modernization feature flag)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('defaults modernChatEnabled to true on first read', async () => {
    const { useUiStore } = await import('@/lib/ui-store');
    expect(useUiStore.getState().modernChatEnabled).toBe(true);
  });

  it('defaults modernChromeEnabled to true on first read', async () => {
    const { useUiStore } = await import('@/lib/ui-store');
    expect(useUiStore.getState().modernChromeEnabled).toBe(true);
  });

  it('setModernChatEnabled updates state and persists', async () => {
    const { useUiStore } = await import('@/lib/ui-store');
    useUiStore.getState().setModernChatEnabled(false);
    expect(useUiStore.getState().modernChatEnabled).toBe(false);

    vi.resetModules();
    const { useUiStore: reloaded } = await import('@/lib/ui-store');
    expect(reloaded.getState().modernChatEnabled).toBe(false);
  });

  it('falls back to defaults when localStorage is corrupt', async () => {
    localStorage.setItem('tadashboard.ui.v1', 'not-json{');
    vi.resetModules();
    const { useUiStore } = await import('@/lib/ui-store');
    expect(useUiStore.getState().modernChatEnabled).toBe(true);
    expect(useUiStore.getState().modernChromeEnabled).toBe(true);
  });

  it('uses localStorage when available, memory-only fallback otherwise', async () => {
    const original = window.localStorage;
    // @ts-expect-error: simulate SSR / unavailability
    delete (window as { localStorage?: Storage }).localStorage;
    try {
      vi.resetModules();
      const { useUiStore } = await import('@/lib/ui-store');
      useUiStore.getState().setModernChatEnabled(false);
      expect(useUiStore.getState().modernChatEnabled).toBe(false);
    } finally {
      window.localStorage = original;
    }
  });
});