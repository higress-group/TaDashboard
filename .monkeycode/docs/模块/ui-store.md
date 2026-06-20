# `src/lib/ui-store.ts`

Feature flag 持久化 store。给"现代聊天"和"现代 chrome"提供 kill switch，用户可在 Settings 面板切换并写入 `localStorage`，下次访问自动恢复。

## 状态

```ts
interface UiState {
  modernChatEnabled: boolean;       // 默认 true
  modernChromeEnabled: boolean;     // 默认 true
  setModernChatEnabled: (v: boolean) => void;
  setModernChromeEnabled: (v: boolean) => void;
}
```

## 关键设计

- **Zustand + `persist` 中间件**：避免引入 Context Provider；状态访问走 `useUiStore((s) => s.field)` 细粒度订阅。
- **jsdom 探测** (`createStorage`)：在创建 `localStorage` 代理前用 `setItem` 探针写一遍，捕获后回退到 `getItem: () => null` 的内存 stub，确保 SSR / 隐私模式不崩。
- **corrupt JSON fallback** (`merge`)：若 `localStorage` 写入被外部工具破坏，`merge` 仅做 shallow merge 而不抛错，下次写入自动覆盖。
- **storage key**：`tadashboard.ui.v1`，版本 `1`；后续如需 schema 变更需 bump `version` 并在 `migrate` 中实现。
- **kill switch 范围**：
  - `modernChatEnabled === false` → `MessageBubble` 退回纯文本；TypingRow 不渲染。
  - `modernChromeEnabled === false` → dashboard 主体包 `ModernChromeFallback`，section body 走原 chrome。

## 消费方

- `src/components/dashboard/hi-claw-dashboard.tsx`：顶栏 ModernSectionHeader / section body 切换。
- `src/components/dashboard/sections/chat-section.tsx`：`MessageBubble` 与 `TypingRow` 条件渲染。
- `src/components/dashboard/settings-dialog.tsx`：两个 Switch 控件。

## 契约测试

- `tests/ui-store.test.ts`（5 用例）：default state、setter、jsdom probe fallback、SSR fallback、corrupt JSON merge。

## 引用

- 设计：`specs/agent-chat-modernization/design.md` §"`src/lib/ui-store.ts`"
- 需求：R7-1 / R7-2
