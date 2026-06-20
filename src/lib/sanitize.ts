import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';
import rehypeStringify from 'rehype-stringify';

const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'pre',
  'p', 'br', 'hr', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'a', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sub', 'sup', 'details', 'summary',
]);

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'class', 'id', 'title']);

/**
 * Sanitize HTML to a Matrix-friendly allow-list. Strips `<script>`,
 * inline event handlers, `javascript:` URLs, and any tag or attribute
 * outside the allow-list. Preserves links by rewriting them with
 * `rel="noopener noreferrer" target="_blank"`.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  let result = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
  result = result.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  result = result.replace(/src\s*=\s*["']data:[^"']*["']/gi, '');
  result = result.replace(/\sstyle\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/<\/?(\w+)([^>]*)>/g, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (match.startsWith('</')) return match;
    const filteredAttrs = attrs.replace(/(\w+)\s*=\s*["']([^"']*?)["']/g, (_, name, _val) => {
      return ALLOWED_ATTRS.has(name.toLowerCase()) ? ` ${name}="${_val}"` : '';
    });
    return `<${tag}${filteredAttrs}>`;
  });
  result = result.replace(/<a\s/g, '<a rel="noopener noreferrer" target="_blank" ');
  return result;
}

/**
 * Render a Markdown string to sanitized HTML. Uses the same allow-list
 * as `sanitizeHtml` so output renders consistently in the message
 * bubble. Falls back to a plain-text `<p>` if the parser throws.
 */
export function renderInlineMarkdown(src: string): string {
  if (!src) return '';
  let markdownHtml = '';
  try {
    const file = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkBreaks)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeSanitize, markdownSchema)
      .use(rehypeStringify)
      .processSync(src);
    markdownHtml = String(file);
  } catch {
    return `<p>${escapeHtml(src)}</p>`;
  }
  // remark doesn't always recognise inline raw HTML (e.g. an inline
  // `<a href>` followed by text) — `rehype-raw` only re-inflates HTML
  // nodes the parser already produced. To match the contract that
  // raw HTML in user input is always sanitised, run `sanitizeHtml`
  // over the original source and prefer the sanitised form whenever it
  // differs from the raw string in a way that indicates unprocessed
  // HTML survived the pipeline.
  const sanitized = sanitizeHtml(src);
  const srcHasRawHtml = /<\/?[a-z][^>]*>/i.test(src);
  if (srcHasRawHtml && sanitized !== src) {
    return sanitized;
  }
  return markdownHtml;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// rehype-sanitize default schema drops `href` and many other useful
// attributes. We extend it with the link / image / code attributes
// needed by Markdown output while keeping event handlers and
// `javascript:` URLs out.
const markdownSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ['href'],
      ['target'],
      ['rel'],
      ['title'],
    ],
    code: [['className']],
    pre: [['className']],
    span: [['className']],
  },
  tagNames: Array.from(
    new Set([
      ...(defaultSchema.tagNames ?? []),
      'del',
      's',
      'u',
      'sub',
      'sup',
      'details',
      'summary',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ]),
  ),
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
  },
};