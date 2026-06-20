import { describe, it, expect, vi } from 'vitest';

describe.skip('inspect mock shape', () => {
  it('logs', () => {
    const fn = vi.fn();
    fn('hello', { foo: 1 });
    console.log('first:', fn.mock.calls[0]);
  });
});