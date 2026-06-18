import { describe, it, expect } from 'vitest';
import { phaseToBadgeVariant } from '@/lib/phase-colors';

describe('phaseToBadgeVariant', () => {
  it('maps Running / Ready / Active to default', () => {
    expect(phaseToBadgeVariant('Running')).toBe('default');
    expect(phaseToBadgeVariant('Ready')).toBe('default');
    expect(phaseToBadgeVariant('Active')).toBe('default');
  });

  it('maps Failed to destructive', () => {
    expect(phaseToBadgeVariant('Failed')).toBe('destructive');
  });

  it('maps Pending / Updating / Sleeping to secondary', () => {
    expect(phaseToBadgeVariant('Pending')).toBe('secondary');
    expect(phaseToBadgeVariant('Updating')).toBe('secondary');
    expect(phaseToBadgeVariant('Sleeping')).toBe('secondary');
  });

  it('maps Stopped / Degraded to outline', () => {
    expect(phaseToBadgeVariant('Stopped')).toBe('outline');
    expect(phaseToBadgeVariant('Degraded')).toBe('outline');
  });

  it('returns secondary for unknown phases', () => {
    expect(phaseToBadgeVariant('UnknownPhase')).toBe('secondary');
    expect(phaseToBadgeVariant('')).toBe('secondary');
  });
});
