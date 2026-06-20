# `phase-timeline` 模块

> 文件位置：`src/lib/phase-timeline.ts` · 组件：`src/components/dashboard/phase-timeline.tsx`

从 Worker 事件流（`/api/v1/workers/{name}/events`）中抽取 phase 变更事件，渲染为垂直时间线。

## 抽取规则

事件被认定为 phase 变更事件的判定（任一满足）：

1. `event.type`（小写）包含 `phase` 字串（如 `phase_changed`）
2. `event.phase` 是合法的 `WorkerPhase` 枚举值
3. `event.message` 包含 `phase` 字串

`toPhase` 抽取优先级：

1. `event.phase`（大小写不敏感匹配）
2. `event.message` 中 `phase ... to <X>` / `phase changed to <X>` 模式
3. `event.message` 中 `<A> -> <B>` / `<A> → <B>` 模式（取右侧）
4. `event.metadata.phase` 或 `event.metadata.toPhase`
5. 否则跳过该事件

`fromPhase` 抽取：

1. `event.metadata.fromPhase`
2. `event.message` 中 `<A> -> <B>` 模式（取左侧）

## 输出

```typescript
interface PhaseTimelineEntry {
  ts: string;
  fromPhase: WorkerPhase | null;
  toPhase: WorkerPhase;
  reason: string;
}
```

按 `ts` 倒序。

## 组件

- 垂直时间线，左侧 `cyan-500/70` 圆点 + 1px 灰线
- 每行：`[from Badge] → [to Badge] [相对时间] [原因文案]`
- Loading / Error / 空状态 / Controller 404 各有占位文案

## 复用点

- `WorkerTraceDialog`（v2）顶部嵌入
- `WorkerDetailDialog` "活动时间线" 分组嵌入

## 测试

`tests/phase-timeline.test.ts`（9 用例）：6 `extractPhaseTimeline` + 3 `isPhaseEvent`
