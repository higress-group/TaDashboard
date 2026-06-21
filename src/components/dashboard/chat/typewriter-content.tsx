'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { renderInlineMarkdown } from '@/lib/markdown';
import { sanitizeHtml } from '@/lib/sanitize';
import { cn } from '@/lib/utils';

interface TypewriterContentProps {
  content: string;
  formattedContent?: string;
  isHtml?: boolean;
  isMarkdown?: boolean;
  speedMs?: number;
  onTick?: () => void;
  onComplete?: () => void;
  className?: string;
}

/**
 * Typewriter streaming surface for chat messages.
 *
 * Renders plain text character-by-character while preserving Markdown/HTML
 * support once the full text has streamed in. This gives Agent responses a
 * natural "typing" feel without sending multiple Matrix events.
 */
export function TypewriterContent({
  content,
  formattedContent,
  isHtml,
  isMarkdown,
  speedMs = 12,
  onTick,
  onComplete,
  className,
}: TypewriterContentProps) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    if (content.length === 0) {
      setIsComplete(true);
      onComplete?.();
      return;
    }

    setDisplayedLength(0);
    setIsComplete(false);
    lastFrameRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastFrameRef.current;
      const charsToAdd = Math.max(1, Math.floor(elapsed / speedMs));
      lastFrameRef.current = now;

      setDisplayedLength((prev) => {
        const next = Math.min(content.length, prev + charsToAdd);
        if (next >= content.length) {
          setIsComplete(true);
          onComplete?.();
          return content.length;
        }
        onTick?.();
        rafRef.current = requestAnimationFrame(tick);
        return next;
      });
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [content, speedMs, onComplete]);

  const skip = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setDisplayedLength(content.length);
    setIsComplete(true);
    onComplete?.();
  }, [content, onComplete]);

  const displayedText = content.slice(0, displayedLength);

  // While streaming we render plain text so partial Markdown tokens (e.g.
  // an unclosed `**`) don't break formatting. Once complete we switch to
  // the rich renderer (Markdown / HTML) if applicable.
  if (isComplete) {
    if (isHtml && formattedContent) {
      return (
        <div
          className={cn('matrix-html-content text-sm', className)}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(formattedContent) }}
        />
      );
    }
    if (isMarkdown) {
      return (
        <div
          className={cn('matrix-html-content text-sm', className)}
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(content) }}
        />
      );
    }
  }

  return (
    <span
      className={cn('whitespace-pre-wrap', className)}
      onClick={skip}
      role="button"
      tabIndex={0}
      title="点击跳过打字效果"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') skip();
      }}
    >
      {displayedText}
      {!isComplete && <span className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-current animate-pulse" />}
    </span>
  );
}
