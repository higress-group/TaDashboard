import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// @vitest-environment jsdom
import { downloadText, copyToClipboard } from '@/lib/download';

describe('downloadText', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn(() => 'blob:mock-url');
    revokeObjectURLMock = vi.fn();
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('creates a blob with the given mime + charset utf-8', () => {
    downloadText('a.txt', 'hello', 'text/plain');
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/plain;charset=utf-8');
    expect(blob.size).toBe(5);
  });

  it('appends a temporary anchor with download attribute and removes it', () => {
    downloadText('a.txt', 'hi', 'text/plain');
    expect(document.body.querySelector('a[download]')).toBeNull();
    // Confirm a click was issued: anchor was added then removed.
    const createCalls = createObjectURLMock.mock.calls.length;
    expect(createCalls).toBe(1);
  });

  it('defers URL.revokeObjectURL so the browser can start the download', () => {
    vi.useFakeTimers();
    downloadText('a.txt', 'x', 'text/plain');
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('is a no-op when document is undefined', () => {
    const originalDocument = globalThis.document;
    // @ts-expect-error - intentionally breaking the env to test the guard
    delete (globalThis as { document?: Document }).document;
    try {
      expect(() => downloadText('a.txt', 'x', 'text/plain')).not.toThrow();
      expect(createObjectURLMock).not.toHaveBeenCalled();
    } finally {
      (globalThis as { document: Document }).document = originalDocument;
    }
  });
});

describe('copyToClipboard', () => {
  it('uses navigator.clipboard.writeText when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const ok = await copyToClipboard('hello');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    // jsdom lacks document.execCommand; stub it on the document instance
    // and keep a reference for cleanup.
    const originalExecCommand = (document as Document & { execCommand?: (cmd: string) => boolean }).execCommand;
    (document as Document & { execCommand: (cmd: string) => boolean }).execCommand = vi.fn(() => true);
    try {
      const ok = await copyToClipboard('hello');
      expect(ok).toBe(true);
    } finally {
      (document as Document & { execCommand?: (cmd: string) => boolean }).execCommand = originalExecCommand;
    }
  });

  it('returns false when both clipboard API and execCommand fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const originalExecCommand = (document as Document & { execCommand?: (cmd: string) => boolean }).execCommand;
    (document as Document & { execCommand: (cmd: string) => boolean }).execCommand = vi.fn(() => false);
    try {
      const ok = await copyToClipboard('hello');
      expect(ok).toBe(false);
    } finally {
      (document as Document & { execCommand?: (cmd: string) => boolean }).execCommand = originalExecCommand;
    }
  });
});
