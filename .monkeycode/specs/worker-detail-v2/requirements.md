# Requirements Document

## Introduction

Worker 管理面板目前提供：复制按钮（detail dialog ID 字段）、CSV/JSON 导出、phase 多选过滤、team 过滤、单 worker Trace dialog。

本次需求在已有基础上推进 4 个新功能：

1. 详情 dialog 重做为可复制 + 分组的现代风格
2. Trace dialog 增强：5s 轮询 + 重试 + phase 时间线
3. Worker 卡片与详情 dialog 加资源指标（CPU / 内存 / 镜像）
4. 按 phase 与 team 维度批量操作

`Controller` 指 HiClaw Controller（数据源）。`Dashboard` 指本 TaDashboard 前端。

## Glossary

- **Worker**：HiClaw Controller 管理的执行单元，由 name / phase / state / runtime / image / model / team / role / matrixUserID / roomID / exposedPorts / version 描述
- **Worker Phase**：7 值枚举，Pending / Running / Sleeping / Updating / Stopped / Failed / Ready
- **Trace**：Worker 状态变更事件流，由 Controller `/workers/{name}/events` 端点提供
- **Metrics**：Worker 资源指标（CPU / 内存 / 磁盘），由 Controller `/workers/{name}/metrics` 端点提供
- **Bulk Action**：在多个 Worker 上执行的同一操作（sleep / wake / ensure-ready / delete / export）

## Requirements

### Requirement 1: Worker 详情 Dialog 重做

**User Story:** AS 运维人员，I want 详情 dialog 按基本/运行时/网络/资源/活动 5 个分组呈现，每个 ID 字段都能点复制、roomID 跳到 chat-section、team 跳到 teams-section，so that 我能快速理解 Worker 全貌、跨 section 联动而无需离开当前视图。

#### Acceptance Criteria

1. WHEN 用户点击 Worker 行的"详情"，THE Dashboard SHALL 打开一个 ModernCard 风格 dialog，按 基本信息 / 运行时配置 / 网络 / 资源指标 / 活动时间线 5 个分组渲染。
2. WHILE 详情 dialog 处于打开状态，THE Dashboard SHALL 在 name / image / matrixUserID / roomID / model / exposedPorts 6 个 ID 字段旁渲染 `CopyButton`。
3. WHEN 用户点击 `roomID` 旁的"打开聊天"按钮，THE Dashboard SHALL 关闭详情 dialog 并切换到 chat-section，自动选中该 room。
4. WHEN 用户点击 `team` 旁的"跳转"按钮，THE Dashboard SHALL 关闭详情 dialog 并切换到 teams-section，自动选中该 team。
5. IF Controller 在 10s 内未响应，THE Dashboard SHALL 在 dialog 顶部渲染 amber Alert 提示"数据可能不完整"，并保留已有渲染。

### Requirement 2: Trace Dialog 增强

**User Story:** AS 运维人员，I want Trace dialog 自动每 5s 刷新、重试失败请求、显示 Worker phase 变化时间线，so that 我能实时观察 Worker 状态变化而无需手动操作。

#### Acceptance Criteria

1. WHILE Trace dialog 处于打开状态，THE Dashboard SHALL 每 5s 自动调用 `/api/hiclaw/workers/{name}/events` 刷新事件列表，用户可手动点击"暂停轮询"按钮停止。
2. WHEN Controller 返回 5xx 或网络失败，THE Dashboard SHALL 自动重试最多 3 次（间隔 1s / 2s / 4s 指数退避），全部失败时保留上次成功的数据并显示"刷新失败，联系 Controller 升级"提示。
3. THE Dashboard SHALL 解析事件流，提取 phase 变化事件（事件 type 包含 `phase` 或 metadata 含 `phase` 字段），渲染为时间线（按时间倒序，每行显示 phase + 时间 + 触发原因）。
4. IF 事件流为空，THE Dashboard SHALL 显示"暂无 phase 变更记录"占位文案。
5. WHEN 用户点击"重试"按钮，THE Dashboard SHALL 立即取消当前指数退避计时器并发起一次刷新。

### Requirement 3: Worker 资源指标

**User Story:** AS 运维人员，I want 在 Worker 卡片与详情 dialog 看到 CPU、内存、磁盘 3 个实时资源指标，so that 我能快速识别资源瓶颈 Worker。

#### Acceptance Criteria

1. THE Dashboard SHALL 调用 `/api/hiclaw/workers/{name}/metrics` 拉取 Worker 资源指标，返回结构 `{ cpuPct: number, memPct: number, diskPct: number, updatedAt: string }`（百分比 0-100，未采集时为 null）。
2. WHILE Worker 列表处于显示状态，THE Dashboard SHALL 每 30s 批量拉取一次所有 Worker 的 metrics 指标，并在 Worker 卡片底部渲染 mini-card 显示 CPU / 内存 / 磁盘百分比。
3. IF metrics 拉取失败，THE Dashboard SHALL 在卡片上显示灰底"–"占位，详细错误降级到浏览器 console。
4. WHILE 详情 dialog 处于打开状态，THE Dashboard SHALL 顶部"资源指标"分组渲染 3 个大数字（CPU / 内存 / 磁盘 + 百分比 + 更新于 X 秒前），未采集时显示"尚未采集"。
5. THE Dashboard SHALL 详情 dialog 资源指标每次轮询 10s（区别于列表的 30s），关闭 dialog 时立即停止轮询。

### Requirement 4: 按 Phase 与 Team 维度批量操作

**User Story:** AS 运维人员，I want 在过滤条件变更后能一键对当前过滤后的 Worker 集合执行 sleep / wake / ensure-ready / delete / export 5 种批量操作，so that 我能在 phase 异常（Failed / Stopped）时统一处理。

#### Acceptance Criteria

1. WHEN 用户激活 phase 过滤或 team 过滤后，THE Dashboard SHALL 在过滤条右侧显示"批量操作"下拉按钮（Download icon），点击后展开 sleep / wake / ensure-ready / 删除 / 导出 CSV / 导出 JSON 6 个动作。
2. WHEN 用户点击"批量 sleep"且当前过滤集合 ≥ 1 个 Worker，THE Dashboard SHALL 显示 AlertDialog 确认"对 N 个 Worker 执行 sleep，确认？"。
3. WHEN 用户确认且 Worker 数 > 5，THE Dashboard SHALL 串行执行（每完成 1 个等待响应后继续），并在底部显示进度条"已完成 X / N"。
4. IF 某次请求失败，THE Dashboard SHALL 在进度条上方显示失败 Worker 列表（可点"重试"或"跳过"），不中断剩余批量操作。
5. THE Dashboard SHALL "批量删除"动作要求用户输入"DELETE"大写确认字符。
6. THE Dashboard SHALL "批量导出 CSV/JSON"动作直接走现有 `workersToCsv` / `workersToJson`，无需确认弹窗。
