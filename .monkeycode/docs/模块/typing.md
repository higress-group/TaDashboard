# `src/lib/typing.ts`

Matrix 房间 "m.typing" 节流发布器与失活收集器。Agent 持续发送 typing 事件会导致无意义的 fan-out，本模块在客户端做 4s 节流 + 收到停手后 stop + 失活时间窗外的 typers 清理。

## API

```ts
createTypingPublisher(opts: {
  publish: (typing: boolean) => Promise<void>;
  throttleMs?: number;  // 默认 4000
}) => {
  notify(): void;        // 在 input 变化时调用：第一次发 true，再节流 true
  stop(): Promise<void>; // 立刻发 false 并 dispose
  dispose(): void;       // 清空定时器（不发送 false）
}
```

```ts
pruneStaleTypers(typing: Map<string, { expiresAt: number }>, now: number): void
collectActiveTypers(typing: Map<string, { expiresAt: number }>, now: number, self: string): string[]
```

## 关键设计

- **节流策略**：第一次 `notify()` 立刻 `publish(true)`；后续 `notify()` 在 4s 窗口内不重发；窗口结束自动发 `true`（保持远端 typing 状态）。`stop()` 显式 `publish(false)` 取消定时器。
- **错误吞掉**：`publish` 失败时打印 `console.warn` 但不重试、不抛出；避免后台噪音打断 UI。
- **失活窗口**：typing 事件含 `expiresAt` 字段；`pruneStaleTypers` 在每次 `useMatrixRoomMessages` 状态合并后清理过期项。
- **排自己**：`collectActiveTypers` 过滤 `self` user id，避免自己打字时 TypingRow 出现自己。
- **代理端点**：`/api/matrix/rooms/[roomId]/typing` PUT，超时 10s，502 兜底（已有独立 route）。

## 消费方

- `src/components/dashboard/sections/chat-section.tsx`：`ChatPanel` 在 input 变化 / unmount 时调用。
- `src/hooks/use-matrix.ts`：`useMatrixRoomMessages` 在合并 `m.typing` 事件时调用 `collectActiveTypers` 算 `typingUsers`。
- `src/components/dashboard/chat/typing-row.tsx`：消费 `typingUsers` 渲染三点动画。

## 契约测试

- `tests/typing.test.ts`（5 用例）：首次立即发、节流窗口内不重发、stop 发 false、dispose 不发、pruneStaleTypers 清除过期、collectActiveTypers 排除自己。

## 引用

- 设计：`specs/agent-chat-modernization/design.md` §"`src/lib/typing.ts`"
- 需求：R1-1 / R1-2 / R1-3
