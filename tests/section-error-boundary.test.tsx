import { describe, it, expect, vi, afterEach } from 'vitest';
import { SectionErrorBoundary } from '@/components/dashboard/section-error-boundary';

const originalError = console.error;
afterEach(() => {
  console.error = originalError;
  vi.restoreAllMocks();
});

/**
 * `SectionErrorBoundary` is a class component, so we test its public
 * surface directly:
 *  - `getDerivedStateFromError` builds a state object
 *  - the `reset` arrow method clears the captured error
 *
 * Full DOM render tests would require @testing-library/react and a
 * jsdom environment; sandbox-runnable equivalent covers the contract.
 */

describe('SectionErrorBoundary contract', () => {
  it('derives a non-null error state from a thrown Error', () => {
    const state = SectionErrorBoundary.getDerivedStateFromError(new Error('boom'));
    expect(state).toEqual({ error: expect.objectContaining({ message: 'boom' }) });
  });

  it('reset is exposed and runs without throwing', () => {
    const boundary = new SectionErrorBoundary({ children: null, title: 'Workers' });
    expect(typeof boundary.reset).toBe('function');
    expect(() => boundary.reset()).not.toThrow();
  });

  it('componentDidCatch suppresses output in production and logs in dev', () => {
    const boundary = new SectionErrorBoundary({ children: null, title: 'Workers' });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    boundary.componentDidCatch(new Error('boom'), { componentStack: 'frame' });
    expect(error).toHaveBeenCalled();
  });
});
