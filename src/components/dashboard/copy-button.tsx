'use client';

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  /** The value to copy. */
  value?: string;
  /** Legacy alias of `value`; kept for sections that pre-date the rename. */
  text?: string;
  /** Optional label shown next to the icon. */
  label?: string;
  /** Optional tooltip. */
  title?: string;
  /** Visual size. */
  size?: 'sm' | 'icon';
  className?: string;
  /** Called after a successful copy. */
  onCopied?: () => void;
}

const RESET_MS = 1500;

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy-to-clipboard button with optimistic visual feedback. Falls back
 * to a `document.execCommand` path when the modern `navigator.clipboard`
 * API is unavailable (older browsers, http://, sandboxed iframes).
 */
function CopyButtonImpl({ value, text, label, title, size = 'icon', className, onCopied }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolved = value ?? text ?? '';

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(resolved);
    if (!ok) return;
    setCopied(true);
    onCopied?.();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), RESET_MS);
  }, [resolved, onCopied]);

  if (size === 'sm') {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-6 px-2 text-[10px] gap-1', className)}
        onClick={handleCopy}
        title={title ?? (copied ? '已复制' : '复制')}
        aria-label={title ?? (copied ? '已复制' : '复制')}
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        {label && <span>{copied ? '已复制' : label}</span>}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-6 w-6', className)}
      onClick={handleCopy}
      title={title ?? (copied ? '已复制' : '复制')}
      aria-label={title ?? (copied ? '已复制' : '复制')}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

// Most call sites pass stable string `value`/`text`/`label` props.
// memo skips re-renders when the parent section re-renders for an
// unrelated reason (e.g. a single worker detail update).
export const CopyButton = memo(CopyButtonImpl);