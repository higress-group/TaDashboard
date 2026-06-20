import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-exported from `@/lib/sanitize` so existing call sites keep working.
// The allow-list and behaviour live in `src/lib/sanitize.ts` now.
export { sanitizeHtml, renderInlineMarkdown } from '@/lib/sanitize';