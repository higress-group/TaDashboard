# `src/lib/a2ui.ts`

Google A2UI 协议 payload 解析与 React 渲染器。Agent 发送的"按钮 + 表单 + 列表"等结构化内容不再以 JSON 字面量倒给用户，而是直接渲染为可交互 UI。

## API

```ts
parseA2UIPayload(body: unknown): A2UIDocument | null
// 接受 body.a2ui / content.a2ui / 顶层 A2UI；不识别返 null。

renderA2UI(doc: A2UIDocument): A2UINode
// 把 A2UIDocument 解析为 React 元素树，未知 component 走 fallback。
```

## 支持组件（首版 8 个）

| component | 渲染目标 |
|---|---|
| `card` | `ModernCard` 容器 |
| `row` / `column` | flex 横/纵排 |
| `text` | `<p>` 文本（可设 variant） |
| `image` | `<img>` 走 `isAllowedMatrixUrl \|\| isAllowedHiclawUrl` allow-list |
| `button` | `<Button>`，点击 submit 表单到 action endpoint |
| `text-input` | `<Input>`，受控 + form data 合并 |
| `form` | `<form>`，submit 触发 POST |

## 关键设计

- **协议识别**：`parseA2UIPayload` 接受三种入口，避免 Agent 实现差异影响 UI。
- **URL 安全**：action endpoint 走 allow-list 过滤；相对路径放行、绝对 URL 必须命中 matrix/hiclaw 允许 host（含 k8s cluster suffix `.svc` / `.svc.cluster.local` / `.cluster.local`）。
- **未知 component fallback**：未识别的 `component` 类型走 `<div>` 容器 + 文本显示节点 JSON，不抛错。
- **Form 提交**：submit 把所有 `text-input` 字段合并为 `Record<string, string>`，POST 到 endpoint（headers 含 `Content-Type: application/json`）。
- **共享 allow-list**：`src/lib/url-allow-list.ts` 抽离 `buildAllowList(envVar, ...extras)` + `isAllowedMatrixUrl` + `isAllowedHiclawUrl`，被 `proxy-helper.ts`（matrix + hiclaw）共享使用。

## 消费方

- `src/components/dashboard/sections/chat-section.tsx`：`MessageBubble` 最高优先级分支。
- `src/components/dashboard/a2ui/a2ui-renderer.tsx`：shadcn UI 渲染 + 内联错误 + FormNode 接 form data。

## 契约测试

- `tests/a2ui.test.ts`（7 用例）：三种 payload 入口、未知 component 兜底、URL allow-list、action endpoint 过滤、表单数据合并、错误处理。

## 引用

- 设计：`specs/agent-chat-modernization/design.md` §"`src/lib/a2ui.ts`"
- 需求：R3-1 / R3-2 / R3-3
