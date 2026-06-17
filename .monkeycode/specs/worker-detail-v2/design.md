# Worker Detail V2

Feature Name: worker-detail-v2
Updated: 2026-06-17

## Description

在已有 Worker 列表（复制按钮 / CSV·JSON 导出 / phase 过滤 / team 过滤 / 单 worker Trace）基础上推进 4 个独立功能：详情 dialog 重做、Trace dialog 增强、资源指标、按 phase 与 team 批量操作。覆盖 4 个 Requirement / 16 个 EARS 验收条件。

## Architecture

```mermaid
graph LR
  subgraph "UI (workers-section.tsx)"
    A1[WorkerList]
    A2[WorkerCard]
    A3[FilterBar]
    A4[BulkActionBar]
  end
  subgraph "Dialogs"
    D1[WorkerDetailDialog\nv2: 5 sections]
    D2[WorkerTraceDialog\nv2: polling+timeline]
    D3[PhaseTimeline]
  end
  subgraph "Components"
    C1[CopyButton]
    C2[MetricsMiniCard]
    C3[MetricsGroup]
  end
  subgraph "Hooks"
    H1[useWorkerMetrics\nReact Query 30s/10s]
    H2[useWorkerTrace\nReact Query 5s + pause]
    H3[useWorkerBulkAction]
  end
  subgraph "API (Next.js)"
    API1[/api/hiclaw/workers/name/metrics\nNEW]
    API2[/api/hiclaw/workers/name/events\nEXISTING]
    API3[/api/hiclaw/workers/name/sleep\nEXISTING]
    API4[/api/hiclaw/workers/name/wake\nEXISTING]
    API5[/api/hiclaw/workers/name/ensure-ready\nEXISTING]
    API6[/api/hiclaw/workers/name\nDELETE\nEXISTING]
  end
  Controller[(HiClaw Controller)]

  A1 --> A2
  A1 --> A3
  A1 --> A4
  A2 --> C2
  A2 --> D1
  A2 --> D2
  D1 --> C1
  D1 --> C3
  D1 --> D3
  D2 --> D3
  A4 --> H3
  C2 --> H1
  C3 --> H1
  D2 --> H2
  H1 --> API1
  H2 --> API2
  H3 --> API3
  H3 --> API4
  H3 --> API5
  H3 --> API6
  API1 --> Controller
  API2 --> Controller
  API3 --> Controller
  API4 --> Controller
  API5 --> Controller
  API6 --> Controller
```

- **Data flow**：UI → React Query hook → Next.js API proxy → HiClaw Controller
- **跨 section 联动**：`roomID` / `team` 跳转通过 `useHiClawStore` 设置 active section + 平滑滚动；chat-section 接收 `roomID` 自动切换房间，teams-section 接收 `teamName` 定位 team

## Components and Interfaces

### `WorkerDetailDialog` (重写 — 现状 key-value 平铺，改为 5 分组)

```typescript
interface WorkerDetailDialogProps {
  worker: WorkerResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToChat?: (roomID: string) => void;
  onJumpToTeam?: (teamName: string) => void;
}

// 内部用 5 个 section:
// 基本信息: name / phase / state / team (跳转) / role / roomID (跳转聊天)
// 运行时配置: runtime / model / image (CopyButton) / version
// 网络: matrixUserID (CopyButton) / exposedPorts (表格 + CopyButton)
// 资源指标: <MetricsGroup workerName={name} /> (10s 轮询)
// 活动时间线: <PhaseTimeline workerName={name} /> (5s 轮询)
```

### `MetricsMiniCard` (Worker 卡片底部)

```typescript
interface MetricsMiniCardProps {
  metrics: WorkerMetrics | null;
  loading: boolean;
}

interface WorkerMetrics {
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
  updatedAt: string; // ISO
}
```

### `MetricsGroup` (详情 dialog 顶部)

```typescript
interface MetricsGroupProps {
  workerName: string;
  // 内部 useWorkerMetrics(name, { refetchInterval: 10_000 })
  // 渲染 3 个大数字 + 进度条
}
```

### `PhaseTimeline` (新组件)

```typescript
interface PhaseTimelineProps {
  workerName: string;
  // 内部 useWorkerTrace(name) 抽 phase 事件
  // 倒序展示, 每行: phase Badge + 时间 + 触发原因
  // 抽取规则: ev.type 包含 "phase" / ev.phase 是 WorkerPhase 字符串 / ev.message 含 "phase changed"
}

interface PhaseTimelineEntry {
  ts: string;
  fromPhase: WorkerPhase | null;
  toPhase: WorkerPhase;
  reason: string;
}
```

### `WorkerTraceDialog` (重写)

保持外部 props `workerName / open / onOpenChange` 不变；内部增加：
- 暂停/恢复轮询按钮（toggle 状态 `paused`）
- 重试按钮（取消当前指数退避计时器）
- 3 次指数退避 1s/2s/4s（失败 → wait 1s 重试；再失败 → 2s；再失败 → 4s；最终失败保留上次数据 + 错误条）
- 顶部 `<PhaseTimeline />` 子组件
- 错误条 Alert "刷新失败，联系 Controller 升级"

### `BulkActionBar` (新组件)

```typescript
interface BulkActionBarProps {
  filteredWorkers: WorkerResponse[];
  filtersActive: boolean;  // 任一过滤激活
  onAfter?: () => void;    // 触发列表 invalidate
}
```

- DropdownMenu 6 动作：Sleep / Wake / Ensure-Ready / 删除 (DELETE 确认) / 导出 CSV / 导出 JSON
- 走 React Query 的 `useMutation`，串行（`for...of` + `await`）
- 进度条：底部 sticky，宽度 = `done/total`
- 失败：累计 `failures: Array<{name, error}>`，进度条上方渲染可点重试/跳过的列表

### `useWorkerMetrics` (新 hook)

```typescript
function useWorkerMetrics(name: string | null, options?: { refetchInterval?: number | false }) {
  return useQuery<WorkerMetrics | null>({
    queryKey: ['worker-metrics', name],
    queryFn: () => fetchMetrics(name ?? ''),
    enabled: !!name,
    refetchInterval: options?.refetchInterval ?? 30_000,
    retry: 1,
  });
}
```

## Data Models

### `WorkerMetrics` (新增类型 in `src/lib/hiclaw-api.ts`)

```typescript
export interface WorkerMetrics {
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
  updatedAt: string;
}
```

### `PhaseTimelineEntry` (新)

```typescript
export interface PhaseTimelineEntry {
  ts: string;
  fromPhase: WorkerPhase | null;
  toPhase: WorkerPhase;
  reason: string;
}
```

## Correctness Properties

1. **CopyButton 一致性**：Worker 详情 dialog 的 6 个 ID 字段全部走 `CopyButton` 组件，与 humans-section 共用同一组件（保留 `text` 旧 alias 防回归）
2. **Trace 不重不漏**：暂停时立即停止轮询 timer，恢复时立即拉取一次再启动定时器
3. **Metrics 缓存**：30s 列表 + 10s 详情 dialog = 不同 `queryKey` (`['worker-metrics', name, 'list']` vs `'detail'`)，React Query 自动去重
4. **Bulk Action 进度**：串行执行 `for...of`，第 N 个失败不中断 N+1；但 UI 必须等全部结束才隐藏进度条
5. **跳转联动**：调用 `useHiClawStore.setActiveSection('chat' | 'teams')` + 平滑滚动到 section，关闭详情 dialog
6. **权限边界**：批量删除走 AlertDialog `DELETE` 字符确认（防误操作）
7. **类型安全**：所有新组件 props 显式声明，避免 `any`

## Error Handling

| 场景 | 行为 |
|---|---|
| Trace 5xx | 1s → 2s → 4s 退避重试 3 次，保留上次数据 + 错误条 |
| Trace 404 | 立即显示"Controller 不支持 events"占位，不重试 |
| Metrics 5xx | React Query 1 次重试，失败时 mini-card 显示 `–` |
| Metrics 404 | mini-card 永久显示 `–`（Controller 暂不支持） |
| 详情 dialog 加载 10s 无响应 | 顶部 amber Alert"数据可能不完整" |
| Bulk Sleep 单 worker 失败 | 进度条上方显示失败列表，点重试/跳过 |
| 用户取消 Bulk AlertDialog | 不执行任何操作 |
| API 401/403 | 走现有 ConnectionBanner 降级到 token 重新输入 |
| 跳转目标 section 关闭 | dashboard 层 `onSectionChange` 处理 fallback |

## Test Strategy

新增 4 个契约测试 + 1 个集成测试：

| 文件 | 用例 | 覆盖 |
|---|---|---|
| `tests/worker-metrics.test.ts` | 200 成功 / 404 null / 5xx throw / 401 throw / URL 编码 | `fetchMetrics` + `/api/hiclaw/workers/.../metrics` |
| `tests/phase-timeline.test.ts` | 抽 phase 事件（type 含 phase / 字段 phase / message 含 phase）/ 倒序 / 空数组 / 非 phase 事件忽略 | `extractPhaseTimeline` |
| `tests/worker-bulk.test.ts` | 串行执行 / 失败列表 / 重试单 worker / 跳过 / 全成功 / 0 worker 直接 return | `runBulkAction` |
| `tests/trace-retry.test.ts` | 1s 退避 / 2s 退避 / 4s 退避 / 重试按钮取消计时器 / 暂停/恢复不重置 | `useTraceRetry` 逻辑 |
| `tests/detail-dialog.test.tsx` | 5 分组渲染 / CopyButton 6 处 / 跳转回调 / amber Alert | `WorkerDetailDialog` 组件 |

测试前置条件：先写 _specs 跑红，转绿后移回 tests/。

## References

- `src/components/dashboard/worker-trace.tsx`：现状 trace dialog（要重写）
- `src/lib/hiclaw-api.ts:21-39`：`WorkerResponse` 类型
- `src/lib/worker-export.ts`：现有 CSV/JSON 序列化
- `src/lib/phase-colors.ts:38-46`：`WORKER_PHASE_LABELS` 中文标签
- `.monkeycode/specs/worker-detail-v2/requirements.md`：本设计对应需求
- `.monkeycode/docs/专有概念/Worker.md`：Worker 状态机
