# `trace-retry` 模块

> 文件位置：`src/hooks/use-trace-retry.ts`

Trace 拉取的指数退避重试器，1s / 2s / 4s 三次后退避停止。

## API

```typescript
const controller = createTraceRetry(fetcher);
// controller.run() — 启动一次重试链
// controller.cancel() — 取消当前链，timer 立即清理
// controller.pause() / controller.resume()
// controller.getState() → { lastError, attempt, paused }
```

## 退避表

| attempt | delay |
|---|---|
| 第 1 次失败 | 1s |
| 第 2 次失败 | 2s |
| 第 3 次失败 | 4s |
| 第 4 次失败 | 不再重试，抛 lastError |

## React 集成

`useTraceRetry(fetcher, { enabled, intervalMs })` 包装 controller：
- `enabled=true && !paused` 时启动轮询，间隔 `intervalMs`（默认 5000）
- 卸载时 `controller.cancel()` + 清理 poll timer
- `retry()` 动作：取消当前 controller + 立即拉一次（"重试"按钮）

## 与 WorkerTraceDialog 的关系

- 暂停按钮 → `setPaused(true)` → 暂停重试
- 重试按钮 → `controller.retry()` → 取消当前 backoff timer 并立即拉取
- 顶部红色 Alert 错误条：3 次重试全部失败后展示"刷新失败，联系 Controller 升级"

## 测试

`tests/trace-retry.test.ts`（5 用例）：1s/2s/4s 退避 + cancel + pause/resume
