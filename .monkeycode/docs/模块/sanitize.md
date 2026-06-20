# `src/lib/sanitize.ts`

统一的 HTML 消毒与内联 Markdown 渲染管线。所有用户输入的富文本在插入 DOM 前都需经过本模块处理。

## API

```ts
sanitizeHtml(html: string): string
// 走 rehype-sanitize + 自定义 allowedTags / allowedAttrs；
// 拒绝 <script>、on* 事件处理器、javascript: 协议。

renderInlineMarkdown(src: string): string
// remark-parse + remark-gfm + remark-breaks + remark-rehype + rehype-raw
// + rehype-sanitize + rehype-stringify；失败时退化为 sanitizeHtml(src)。
```

## 关键设计

- **双轨渲染**：
  - `Matrix.formattedContent` 已有 HTML → `sanitizeHtml` 单轨。
  - 纯文本含 `[]()` / `*` / `` ` `` / ``` ``` ``` / HTML 标签 → `renderInlineMarkdown` 双轨：先 remark 解析为 mdast，rehype-raw 处理 `html` 节点（保留 inline `<a>`），再走同一个 sanitize schema。
- **协议白名单**：`markdownSchema` 显式列 `href: ['http', 'https', 'mailto']`，避免 rehype-sanitize 默认 schema 把所有链接删光。
- **Type 来源**：`type Schema` 单独从 `hast-util-sanitize` import（`rehype-sanitize` 的同名 re-export 实际不存在）。
- **失败兜底**：`renderInlineMarkdown` 用 `try/catch` 包裹，失败时返回 `sanitizeHtml(src)`（即把原文当 HTML 走消毒），最终结果是文本而不是空串或异常。
- **依赖链**：`unified` + `remark-parse` + `remark-gfm` + `remark-breaks` + `remark-rehype` + `rehype-raw` + `rehype-sanitize` + `rehype-stringify` + `hast-util-sanitize`。

## 消费方

- `src/components/dashboard/sections/chat-section.tsx`：`MessageBubble` 渲染分支（先 A2UI → 再 HTML → 再 Markdown → 最后纯文本）。
- `src/lib/utils.ts`：re-export 旧 API 保持向后兼容。

## 契约测试

- `tests/markdown.test.ts`（6 用例）：inline code、fenced code、`<br>`、`<script>` 剥离、事件处理器剥离、纯文本 fallback。

## 引用

- 设计：`specs/agent-chat-modernization/design.md` §"`src/lib/sanitize.ts`"
- 需求：R2-1 / R2-2 / R2-3
