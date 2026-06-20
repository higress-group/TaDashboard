# Worker Detail V2 - Task List

## 阶段 1：基础设施

- [x] **1.1** 创建 `tests/_specs/worker-detail-v2/worker-metrics.test.ts`（5 用例：200 / 404 null / 5xx / 401 / URL 编码）—— 跑红
- [x] **1.2** 创建 `src/lib/worker-metrics.ts`：`fetchMetrics(name)` 走 `/api/hiclaw/workers/{name}/metrics`，404 返 null
- [x] **1.3** 创建 `src/app/api/hiclaw/workers/[name]/metrics/route.ts` GET 代理
- [x] **1.4** `src/lib/hiclaw-api.ts` 新增 `getWorkerMetrics(name)` + `WorkerMetrics` 类型
- [x] **1.5** 测试 1.1 → 1.4 转绿后移回 `tests/worker-metrics.test.ts`

## 阶段 2：Metrics 组件 + Hook

- [x] **2.1** 创建 `src/hooks/use-worker-metrics.ts`：`useWorkerMetrics(name, opts)` 走 React Query（refetchInterval 30s/10s/disabled）
- [x] **2.2** 创建 `src/components/dashboard/worker-metrics-mini-card.tsx`：3 指标 mini-card (CPU/内存/磁盘)
- [x] **2.3** 创建 `src/components/dashboard/worker-metrics-group.tsx`：3 大数字 + 进度条（用 `useWorkerMetrics(name, { refetchInterval: 10_000 })`）
- [x] **2.4** 接入 workers-section Worker 卡片底部渲染 mini-card（30s 轮询）

## 阶段 3：Phase Timeline 组件

- [x] **3.1** 创建 `tests/_specs/worker-detail-v2/phase-timeline.test.ts`（5 用例：type 含 phase / 字段 phase / message 含 phase / 倒序 / 空数组）—— 跑红
- [x] **3.2** 创建 `src/lib/phase-timeline.ts`：`extractPhaseTimeline(events)` 返 `PhaseTimelineEntry[]` + `isPhaseEvent(ev)` + `toWorkerPhase(s)`
- [x] **3.3** 创建 `src/components/dashboard/phase-timeline.tsx`：时间线 UI（垂直时间轴 + phase badge + 相对时间）
- [x] **3.4** 测试 3.1 → 3.2/3.3 转绿后移回

## 阶段 4：WorkerTraceDialog 重写

- [x] **4.1** 创建 `src/hooks/use-trace-retry.ts`：1s/2s/4s 退避 + `cancel` + `pause`/`resume` + `lastError`
- [x] **4.2** 创建 `tests/_specs/worker-detail-v2/trace-retry.test.ts`（5 用例：1s 退避 / 2s 退避 / 4s 退避 / cancel / pause）—— 跑红 → 4.1 实现 → 转绿
- [x] **4.3** 重写 `src/components/dashboard/worker-trace.tsx`：暂停按钮 + 重试按钮 + 3 次退避 + 顶部 PhaseTimeline + 错误条 Alert

## 阶段 5：WorkerDetailDialog 重做

- [x] **5.1** 5 分组 UI（基本信息 / 运行时配置 / 网络 / 资源指标 / 活动时间线）—— ModernCard + ModernSectionHeader
- [x] **5.2** 6 个 ID 字段 CopyButton：name / image / matrixUserID / roomID / model / exposedPorts
- [x] **5.3** roomID "打开聊天" 按钮（onJumpToChat）+ team "跳转" 按钮（onJumpToTeam）
- [x] **5.4** amber Alert 10s loading 提示
- [x] **5.5** 创建 `tests/_specs/worker-detail-v2/detail-dialog.test.tsx`（4 用例：5 分组 / 6 CopyButton / 跳转回调 / amber Alert）—— 跑红 → 5.1-5.4 实现 → 转绿

## 阶段 6：BulkActionBar

- [x] **6.1** 创建 `src/hooks/use-worker-bulk-action.ts`：`runBulkAction(workers, action)` 串行执行 + 失败列表 + 重试/跳过
- [x] **6.2** 创建 `tests/_specs/worker-detail-v2/worker-bulk.test.ts`（6 用例：串行 / 失败 / 重试 / 跳过 / 全成功 / 0 worker）—— 跑红 → 6.1 实现 → 转绿
- [x] **6.3** 创建 `src/components/dashboard/worker-bulk-action-bar.tsx`：DropdownMenu 6 动作 + AlertDialog DELETE 确认 + 进度条
- [x] **6.4** 接入 workers-section 过滤条右侧

## 阶段 7：收尾

- [x] **7.1** 全量回归：lint 0 / vitest 全过 / build 干净
- [x] **7.2** 新增 2 个 wiki 模块页：`worker-metrics.md` / `phase-timeline.md` + INDEX.md 加 2 行
- [x] **7.3** 阶段 7 commit + push
