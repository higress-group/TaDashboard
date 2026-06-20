// Markdown rendering surface. The pipeline lives in `@/lib/sanitize`;
// this module is a thin alias so the contract tests can import a
// stable path while the implementation moves.
export { renderInlineMarkdown } from '@/lib/sanitize';