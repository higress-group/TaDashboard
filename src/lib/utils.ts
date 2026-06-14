import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize HTML to prevent XSS attacks.
 * Strips dangerous tags and attributes while preserving safe formatting.
 * Lightweight alternative to DOMPurify for Matrix message content.
 */
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'del', 'code', 'pre',
  'p', 'br', 'hr', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'a', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sub', 'sup', 'details', 'summary',
]);

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'class', 'id', 'title']);

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Remove script tags and their content
  let result = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handlers and dangerous attributes
  result = result.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
  // Remove javascript: URLs
  result = result.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  // Remove data: URLs in src
  result = result.replace(/src\s*=\s*["']data:[^"']*["']/gi, '');
  // Remove style attributes (can contain expression/url attacks)
  result = result.replace(/\sstyle\s*=\s*["'][^"']*["']/gi, '');
  // Filter tags - keep only allowed ones
  result = result.replace(/<\/?(\w+)([^>]*)>/g, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    // For closing tags, return as-is
    if (match.startsWith('</')) return match;
    // Filter attributes
    const filteredAttrs = attrs.replace(/(\w+)\s*=\s*["']([^"']*?)["']/g, (_, name, _val) => {
      return ALLOWED_ATTRS.has(name.toLowerCase()) ? ` ${name}="${_val}"` : '';
    });
    return `<${tag}${filteredAttrs}>`;
  });
  // Add rel=noopener to all links
  result = result.replace(/<a\s/g, '<a rel="noopener noreferrer" target="_blank" ');
  return result;
}
