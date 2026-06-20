'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';

export interface TypingRowProps {
  typingUsers: string[];
  selfUserId?: string | null;
}

/**
 * Animated "X is typing…" row that mounts directly above the chat
 * input. Renders nothing when `typingUsers` is empty. Excludes the
 * local user so we don't render "You are typing…" beside the input
 * the user is currently typing into.
 */
export function TypingRow({ typingUsers, selfUserId }: TypingRowProps) {
  const others = typingUsers.filter((u) => u !== selfUserId);

  return (
    <AnimatePresence>
      {others.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-0.5">
            <Dot delay={0} />
            <Dot delay={150} />
            <Dot delay={300} />
          </span>
          <span>
            {others.length === 1
              ? `${shortName(others[0])} 正在输入`
              : `${others.length} 人正在输入`}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="inline-block w-1 h-1 rounded-full bg-orange-500"
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay: delay / 1000, ease: 'easeInOut' }}
    />
  );
}

function shortName(userId: string): string {
  if (!userId.startsWith('@')) return userId;
  return userId.split(':')[0].slice(1);
}

// Re-export the lucide icon so the existing chat-section import line
// stays intact even after the row was extracted.
export { MoreHorizontal };