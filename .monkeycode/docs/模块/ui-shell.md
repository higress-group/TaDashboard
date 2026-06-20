# 共享 UI 表层 / 格式助手 / 选择器 (ui-shell)

涵盖为收敛 Dashboard 重复 UI 模式而抽取的一组共享模块。

## 文件
| 文件 | 职责 |
|---|---|
| `src/components/dashboard/surface-shell.tsx` | 统一卡片骨架 `SurfaceShell` + 空态 `SurfaceEmptyState` + 骨架网格 `SurfaceSkeletonGrid` |
| `src/lib/format.ts` | 通用数值/进度条/时间格式化函数 |
| `src/hooks/use-hiclaw-store-selectors.ts` | 细粒度 zustand `useShallow` 选择器，避免无关 store 变化触发重渲染 |
| `src/components/dashboard/section-error-boundary.tsx` | React class 错误边界，按 section 隔离崩溃 + "重试"按钮 |
| `src/app/api/hiclaw/workers/[name]/fallback-helper.ts` | metrics/events 路由共享的 controller 降级逻辑 |

---

## SurfaceShell

`src/components/dashboard/surface-shell.tsx:15-103`

统一替代三处重复模式：
- `Card className="glass-card"` → `SurfaceShell`
- 每个 section 单独写的 "暂无数据" 空态 → `SurfaceEmptyState`
- 加载骨架（3 列 x N 行 grid）→ `SurfaceSkeletonGrid`

### API

```tsx
// 卡片容器
<SurfaceShell
  hover              // 可选：hover 时微妙 lift + 阴影
  contentClassName="p-4 space-y-3"  // 内容区 class
  className="..."    // 外层 wrapper class
>
  {children}
</SurfaceShell>

// 空状态
<SurfaceEmptyState
  icon={<UserCheck className="w-8 h-8" />}
  title="暂无人员"
  description="点击右上角「创建」添加"
/>

// 骨架
<SurfaceSkeletonGrid count={6} cols={3} rows={2} />
```

### 设计决策
- `hover` prop 控制 `hover:shadow-xl` + `hover:scale-[1.01]` 的渐变 lift 效果（卡片的 `hover-lift` 类名被废弃）
- 无 `Card` 依赖：`SurfaceShell` 直接用 div 渲染，避免 shadcn Card 的 DOM 深度
- `contentClassName` 分隔 wrapper 与内容 padding：表格视图传 `p-0 overflow-hidden`，其他传 `p-4`

---

## format.ts

`src/lib/format.ts:1-62`

从 worker-metrics-group / worker-metrics-mini-card / phase-timeline / workers-section 等 12+ 处提取的共享格式化函数。

### API

```ts
formatPct(value: number): string       // 12.3% (保留 1 位小数)
pctColorClass(value: number): string   // text-emerald-500 / text-amber-500 / text-rose-500
pctTextClass(value: number): string    // 同 pctColorClass，用于文字
pctBarWidth(value: number): string     // "40%" (css width，代 bar 进度)
timeAgo(isoString: string): string     // 3 分钟前 / 1 小时前 / 2 天前
```

### 设计决策
- 三种颜色档位：≤60% 绿、≤85% 橙、>85% 红
- `timeAgo` 用秒/分/小时/天四级渐变，超过 7 天返 "N 天前"
- 不依赖 `dayjs` / `date-fns`：纯手写轻量版
- 所有函数纯 stateless，`pctBarWidth` 无副作用

---

## useHiclawStoreSelectors

`src/hooks/use-hiclaw-store-selectors.ts:1-46`

替代直接 import `useHiClawStore()` 的细粒度选择器，用 zustand `useShallow` 包住大字段，避免设置变更时无关 UI 重渲染。

### API

```ts
useIsConnected(): boolean
  // state => state.isConnected，最轻量

useConnectionMeta(): { latency, lastSeen, lastError, retryCount, isRetrying }
  // 一组连接状态，用 useShallow 包

useSettingsDialog(): { settingsOpen, setSettingsOpen, toggleSettings }
  // settings 对话框状态 + 操作
```

### 设计决策
- `useShallow` 从 `zustand/react/shallow` 导入（zustand v5.0.14）
- settings dialog 原直接 `useHiClawStore()` 订阅全量 state，任何 store 变化（如 auto-reconnect tick）都会触发 dialog 重渲染；切到 `useConnectionMeta` 后只订阅 5 个字段
- `HiClawState` 从 `export interface` 导出，确保 `useShallow` 泛型参数能显式标注

---

## SectionErrorBoundary

`src/components/dashboard/section-error-boundary.tsx:1-58`

React class 组件错误边界。每个 section 顶层包装，一个 section 崩溃不影响整页。

### API

```tsx
<SectionErrorBoundary title="Workers">
  <WorkersSection />
</SectionErrorBoundary>
```

props:
- `title?: string` — 标识 section 名字（兜底 UI 显示 "xxx 加载失败"）
- `sectionName?: string` — `title` 的别名（调用方可读性）

### 行为
- `getDerivedStateFromError` 捕获子组件树的 `throw`
- 渲染 `SurfaceShell` + 错误消息 + "重试" button（`reset()` 清空 state → 重渲染）
- `componentDidCatch` 在非 production 环境 `console.error`，生产环境静默

---

## fallback-helper.ts

`src/app/api/hiclaw/workers/[name]/fallback-helper.ts:1-48`

metrics + events 两个路由文件共享的 controller 降级逻辑。原每个路由 60+ 行（手动 fetch + error handling + fallback），抽到此文件后每个路由 15 行。

### API

```ts
proxyWorkerSubresourceOrFallback<T>(
  workerName: string,
  subresourcePath: string,       // "/metrics" or "/events"
  synthesize: (worker: WorkerResponse) => T,
  wrap: (data: T) => object,
): Promise<NextResponse>
```

### 行为
1. `fetchWorkerByName(workerName)` 从 controller 拿完整 worker JSON
2. 若 worker 不存在（404）→ 返回 404（不吞 404）
3. 若 controller 5xx 或 JSON 解析失败 → 返回 502（区分于 worker 不存在）
4. 尝试 `fetchWorkerSubresource(workerName, subresourcePath)` 从 controller 拿 native metrics/events
5. 若 subresource 返回 404 → 走 `synthesize(worker)` 生成合成数据
6. 其他错误 → 直接向上 throw（不吞）

### 设计决策
- `SYNTHETIC_METRICS_UPDATED_AT = '1970-01-01T00:00:00Z'` 哨兵：UI 层用 `isSyntheticWorkerMetrics()` 检测并显示"估算"徽章
- 合成 events 基于 hash(workerName) 生成确定性事件流（与旧 `mock-hiclaw.mjs` 一致）
- 区分 404（worker 不存在）、502（controller 异常）、200 合成（降级成功）：`worker-detail-dialog` 可根据 HTTP 码选不同 UI

---

## 使用约定

1. 任何新的 dashboard section 应优先用 `SurfaceShell` 而非裸 `Card + glass-card`
2. 百分比显示优先调 `lib/format` 而非 inline `toFixed`
3. 任何订阅 zustand store 的组件应优先用 `useShallow` 选择器，不直接 `useStore()`
4. 每个 section 顶层包 `SectionErrorBoundary`

## 关联文档
- `worker-metrics.md`：worker 资源指标获取与展示
- `phase-timeline.md`：从 events 流抽取 phase 时间线
- `ui-store.md`：feature flag 持久化
- `hiclaw-store.md`：连接状态 + 自动重连
