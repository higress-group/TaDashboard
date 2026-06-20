/**
 * Interface contract tests for `src/lib/markdown.ts`.
 *
 * Drives the public API of the lightweight Markdown fallback used when
 * a Matrix message arrives with a plain body the Controller did not
 * pre-format.
 */

import { describe, it, expect } from 'vitest';

describe('renderInlineMarkdown', () => {
  it('renders inline code with a <code> tag', async () => {
    const { renderInlineMarkdown } = await import('@/lib/markdown');
    const html = renderInlineMarkdown('use `npm install` first');
    expect(html).toContain('<code>npm install</code>');
  });

  it('renders fenced code blocks with a <pre><code> tag', async () => {
    const { renderInlineMarkdown } = await import('@/lib/markdown');
    const html = renderInlineMarkdown('```\nls -la\n```');
    expect(html).toMatch(/<pre><code[^>]*>[\s\S]*ls -la[\s\S]*<\/code><\/pre>/);
  });

  it('preserves single line breaks via <br>', async () => {
    const { renderInlineMarkdown } = await import('@/lib/markdown');
    const html = renderInlineMarkdown('line one\nline two');
    expect(html).toContain('<br');
  });

  it('strips <script> tags entirely', async () => {
    const { renderInlineMarkdown } = await import('@/lib/markdown');
    const html = renderInlineMarkdown('safe<script>alert(1)</script>tail');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain('safe');
    expect(html).toContain('tail');
  });

  it('strips inline event handlers', async () => {
    const { renderInlineMarkdown } = await import('@/lib/markdown');
    const html = renderInlineMarkdown('<a href="https://example.com" onclick="bad()">link</a>');
    expect(html).not.toMatch(/onclick/i);
    expect(html).toContain('href="https://example.com"');
  });

  it('falls back to escaped plain text when parser throws', async () => {
    const { renderInlineMarkdown } = await import('@/lib/markdown');
    const html = renderInlineMarkdown('hello world');
    expect(html).toContain('hello world');
    expect(html).not.toContain('undefined');
  });
});