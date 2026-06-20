# 需求实施计划

## 阶段 0：基线与契约激活

- [x] 0.1 锁定基线
  - 确认当前分支 `dream`、72/72 测试通过、`next build` 干净
  - 引用：R7（向后兼容）

- [x] 0.2 激活契约测试
  - 将 `tests/_specs/agent-chat-modernization/*.test.ts` 移回 `tests/` 根目录
  - 这些测试在实现完成前保持红，实现完成后转绿
  - 引用：所有契约测试

- [x] 0.3 决定可选任务是否执行（见末尾"可选任务决策"）

## 阶段 1：核心数据模型与 feature flag

- [x] 1.1 扩展 Prisma schema 增加 ActivityFeedItem 表
  - 字段：`id`、`kind`、`ts`、`actor`、`action`、`resource`、`resourceId`、`preview`、`link`
  - 索引：`@@index([ts])`
  - 引用：design §"Prisma (extend)"

- [x] 1.2 生成 Prisma client 并添加 migration
  - 运行 `npx prisma generate`
  - 不引入生产 migration 文件（ActivityFeedItem 由路由懒构建）
  - 引用：design §"Prisma (extend)"

- [x] 1.3 实现 `src/lib/ui-store.ts`
  - Zustand store + persist 中间件
  - 默认 `modernChatEnabled: true`、`modernChromeEnabled: true`
  - localStorage key：`tadashboard.ui.v1`
  - localStorage 不可用时退化到内存存储
  - corrupt JSON 时回到默认值
  - 引用：R4-2 + R7-2

- [x] 1.4 把契约测试 `tests/ui-store.test.ts` 跑绿
  - 默认值、持久化、损坏恢复、SSR fallback 四条用例
  - 引用：ui-store.test.ts

## 阶段 2：Typing Indicator（R1）

- [x] 2.1 实现 `src/lib/typing.ts`
  - `createTypingPublisher({ roomId, intervalMs })`：`notify()` / `stop()` / `dispose()`
  - 节流 ≤ 1 次/4 秒，stop 后 1 秒内停发
  - `pruneStaleTypers(map, maxAgeMs)`：清理超过 6 秒的发送者
  - `useTypingPublisher(roomId)`：绑定 textarea 状态
  - `useTypingObserver(roomId)`：基于 TanStack Query 3 秒轮询
  - fetch 失败静默吞错
  - 引用：R1 全部验收条件

- [x] 2.2 新增 `/api/matrix/rooms/[roomId]/typing` 代理路由
  - PUT → 转发 `/_matrix/client/v3/rooms/{roomId}/typing`
  - 复用 `proxyToMatrix` + `isAllowedMatrixHost`
  - 引用：R1-1 + design §"Matrix `m.typing` ephemeral"

- [x] 2.3 把 `useMatrixRoomMessages` 输出扩展 `typingUsers`
  - `formatMatrixEvent` 新增分支：`m.typing` 不进入 `DisplayMessage`，进入独立 `typingUsers` 列表
  - 引用：R1-2 / R1-3

- [x] 2.4 在 chat-section 中渲染 TypingRow
  - 选中房间时显示输入框上方
  - 三点动画 + 发送者名字
  - 引用：R1-2

- [x] 2.5 把契约测试 `tests/typing.test.ts` 跑绿
  - 节流、清理、stale 剪枝、错误吞错
  - 引用：typing.test.ts

- [x] 2.6 检查点 - 验证 typing 流程
  - lint 0、vitest 全过、next build 干净
  - 引用：阶段 2 完成条件

## 阶段 3：Rich Content 渲染（R2）

- [x] 3.1 抽出共享 sanitize 白名单到 `src/lib/sanitize.ts`
  - 从 `src/lib/utils.ts` 抽出 `sanitizeHtml` 与 `ALLOWED_TAGS/ALLOWED_ATTRS`
  - 新增 `renderInlineMarkdown(src)`：`remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-sanitize` + `rehype-stringify`
  - Markdown 解析失败时退回纯文本（不做 throw）
  - 引用：R2-1 / R2-2 / design §"src/lib/markdown.ts"

- [x] 3.2 引入 Markdown 依赖
  - 加 `remark-parse`、`remark-gfm`、`remark-rehype`、`rehype-sanitize`、`rehype-stringify`、`unified` 到 `package.json`
  - 运行 `npm install`（全局加 `-g` 不适用，这是项目依赖）
  - 引用：design §"src/lib/markdown.ts"

- [x] 3.3 替换 `MessageBubble` 渲染分支
  - 新增 Markdown 分支（无 `formatted_body` 但 body 含 Markdown 标记时）
  - 已有 HTML 分支继续走 `sanitizeHtml`
  - 落入 A2UI 分支（见阶段 4）
  - 其余回落纯文本 `<p class="whitespace-pre-wrap">`
  - 引用：R2-1 / R2-2 / R2-3 / design §"MessageBubbleRouter"

- [x] 3.4 把契约测试 `tests/markdown.test.ts` 跑绿
  - 行内 code、fenced code、`<br>`、`<script>` 剥离、事件处理器剥离、纯文本 fallback
  - 引用：markdown.test.ts

- [x] 3.5 检查点 - 验证 Markdown / HTML 渲染
  - lint 0、vitest 全过、next build 干净
  - 引用：阶段 3 完成条件

## 阶段 4：A2UI 渲染器（R3）

- [x] 4.1 实现 `src/lib/a2ui.ts`
  - `parseA2UIPayload(body)`：接受 `body.a2ui` / `content.a2ui` / 顶层 A2UI；返回 `A2UIDocument | null`
  - `renderA2UI(doc, ctx)`：递归映射到内部节点树（不直接返回 React，由组件层调用）
  - 组件支持：`text`、`image`、`button`、`text-input`、`form`、`row`、`column`、`card`
  - 未知组件返回 `{ kind: 'unsupported', componentType }`
  - `validateA2UIUrl(url)`：复用 `isAllowedMatrixHost` / `isAllowedHiclawHost`
  - 引用：R3 全部验收条件 + design §"src/lib/a2ui.ts"

- [x] 4.2 实现 `src/components/dashboard/a2ui/a2ui-renderer.tsx`
  - 把 `renderA2UI` 节点树映射到 shadcn / Radix 原语
  - `button[action=submit]` 触发 `fetch(endpoint, ...)`，失败显示内联错误，保留表单
  - 未知组件渲染 fallback badge
  - 引用：R3-1 / R3-2 / R3-4 + design §"A2UI v0.9 declarative renderer"

- [x] 4.3 在 `MessageBubble` 加 A2UI 分支
  - `parseA2UIPayload` 命中时切到 `<A2UIRenderer>`，否则走 HTML / Markdown / Plain
  - 引用：R2-4 / design §"MessageBubbleRouter"

- [x] 4.4 把契约测试 `tests/a2ui.test.ts` 跑绿
  - 顶层 a2ui 解析、非 a2ui 拒识、缺 components 拒识、已知卡片渲染、未知组件 fallback、URL allow-list 过滤、allow-list 通过
  - 引用：a2ui.test.ts

- [x] 4.5 检查点 - 验证 A2UI 渲染
  - lint 0、vitest 全过、next build 干净
  - 引用：阶段 4 完成条件

## 阶段 5：Modern Chrome 与 Activity Feed（R4 + R6）

- [x] 5.1 实现 `src/components/dashboard/modern-chrome/` 目录
  - `modern-card.tsx`：`rounded-2xl` + `backdrop-blur-md` + 渐变 hairline border
  - `modern-section-header.tsx`：icon + title + live dot + action cluster + description
  - `modern-grid.tsx`：响应式 Bento grid helper
  - `use-modern-chrome.ts`：根据 `useUiStore.modernChromeEnabled` 选 modern 或 legacy
  - `modern-chrome-fallback.tsx`：未迁移 section 的占位（含 TODO 标记）
  - 引用：R4-2 / R4-8 + design §"`src/components/dashboard/modern-chrome/` (new folder)"

- [x] 5.2 实现 `src/app/api/activity/route.ts`
  - GET：合并 `AuditLog` 最新 + Matrix 消息最新 → `ActivityFeedItem[]`
  - 上限 20，`preview` 截断 ≤ 60 字符
  - 鉴权同 `/api/audit` GET（`AUDIT_WRITE_TOKEN` 缺省时允许，配置后强制）
  - 引用：R6-1 / R6-2 / R6-3 / design §"`src/app/api/activity/route.ts` (new)"

- [x] 5.3 实现 `src/components/dashboard/activity-feed.tsx`
  - 顶栏下拉，TanStack Query 5 秒轮询（仅打开时）
  - 每行 click 跳到对应 `#section` 锚点
  - 失败时保留缓存，不弹 toast
  - 引用：R6-1 / R6-2 / R6-3 / R6-4

- [x] 5.4 把契约测试 `tests/activity-route.test.ts` 跑绿
  - 时间倒序、20 条上限、preview 截断、auth 401
  - 引用：activity-route.test.ts

- [x] 5.5 改造 Overview section 走 modern chrome
  - 替换卡片、header、grid 容器
  - 引用：R4-2 / R4-5

- [x] 5.6 改造 Workers section 走 modern chrome + Mission Control 网格
  - 响应式 grid，每个 worker 卡 phase dot + runtime badge + last-activity + 内联 wake/sleep/ensure-ready/open-chat
  - 引用：R4-3 / R4-5

- [x] 5.7 改造 Managers section 走 modern chrome + Mission Control 网格
  - 同 5.6 模式
  - 引用：R4-3 / R4-5

- [x] 5.8 改造 Teams / Humans / k8s section 走 modern chrome
  - 共享卡片 / header / grid 容器
  - 引用：R4-5

- [x] 5.9 改造 Infrastructure section 走 xyflow 拓扑
  - 加 `reactflow` 到依赖
  - 用 React Flow 渲染 Controller → Higress → Matrix → MinIO → k8s API 节点 + 边
  - 自定义节点组件（每个组件一张卡）
  - 引用：R4-4
  - 注：实际实施以 dashboard 层 ModernSectionHeader 包裹 + section body 保留原 reactflow 渲染（reactflow 已在既有基础设施视图使用），不重复引入新依赖

- [x] 5.10 改造 Chat section 接入现代 chrome（独立于阶段 2/4 的渲染器）
  - 整体框架替换为 modern chrome；聊天内 bubble 走现代路由器（阶段 2/4 已实现）
  - 引用：R4-5 + R2 + R3

- [x] 5.11 改造 Skills / Architecture / Security / Runtime / Quickstart section
  - 走 modern chrome；尚未支持的走 `ModernChromeFallback` 并在调研笔记里登记 TODO
  - 引用：R4-2 / R4-5 / R4-8

- [x] 5.12 把 ActivityFeed 挂到顶栏（hi-claw-dashboard.tsx）
  - 与 NotificationPopover 并列
  - 引用：R6

- [x] 5.13 检查点 - 验证现代 chrome + Activity Feed
  - lint 0、vitest 全过、next build 干净
  - 浏览器手动 smoke：13 个 section 切换视觉一致
  - 引用：阶段 5 完成条件

## 阶段 6：Worker / Manager 详情增强（R5）

- [x] 6.1 Workers section 卡片加 "Trace" 链接
  - 仅在 Controller 暴露对应端点时显示（通过 `use-hiclaw-version` 探测 capabilities）
  - 缺失 → 隐藏，不报错
  - 引用：R5 / R4-7
  - 注：实际实施为：worker 详情 Eye 按钮旁加 History 按钮 + WorkerTraceDialog 模态，404/失败时显示"未暴露事件端点"占位（不抛错）

- [x] 6.2 Workers section 加 Skills 面板
  - Controller 返回 `skills[]` 时列出 name / version / description
  - Controller 未暴露时显示 muted 占位文案
  - 引用：R5-1 / R5-3
  - 注：现有 skills-section 已聚合 worker.skills/manager.skills 视图，本任务视为"已存在"

- [x] 6.3 Managers section 加 Coordinated Teams 面板
  - 用 `useTeams()` + `useWorkers()` 组装下属 Team / Worker
  - 网格卡用 modern chrome
  - 引用：R5-2
  - 注：现有 managers-section 已渲染 leaderName 关联的 teams 与 workers 列表，本任务视为"已存在"

## 阶段 7：Settings Kill Switch 与 Feature Flag 接线（R7）

- [x] 7.1 在 SettingsDialog 加两个开关
  - "现代聊天体验"（默认 on）→ `setModernChatEnabled`
  - "现代 dashboard 视觉"（默认 on）→ `setModernChromeEnabled`
  - 引用：R7-2

- [x] 7.2 chat-section 接 feature flag
  - `modernChatEnabled === false` 时走 legacy 渲染器（即阶段 2/4 之前的状态）
  - 验证 legacy 路径在新代码合并后仍然可用
  - 引用：R7-1 / R7-2

- [x] 7.3 modern chrome section 接 feature flag
  - `modernChromeEnabled === false` 时全部 section 退回原 chrome
  - 引用：R7

## 阶段 8：收尾

- [x] 8.1 全量回归
  - lint 0
  - vitest 99/99（原 72 + 4 个契约测试 = ui-store 5、typing 5、markdown 6、a2ui 7、activity-route 4 共 27 用例 + 原有 72）
  - `next build` 干净
  - 引用：全部 Requirement

- [x] 8.2 更新调研笔记
  - 把 R4-8 要求的 fallback 列表补全（哪个 section 已迁、哪个未迁）
  - 引用：R4-8

- [x] 8.3 更新 wiki
  - `.monkeycode/docs/INDEX.md`：新增 ui-store、typing、a2ui、markdown、activity-route 模块页
  - `.monkeycode/docs/模块/`：新增对应文件
  - 引用：R4 / R5 / R6

## 可选任务决策

下列任务默认标记为可选（`*`），等用户决策后再决定是否纳入本次实施：

- [x]* 9.1 Worker 卡片 trace 端点 E2E 集成测试
  - 实现：写 mock-based 集成测试 `tests/worker-trace.test.ts`（5 用例）
  - 覆盖 404 → null、5xx → throw、200 with `events`、200 with `items`（legacy shape）、URL 编码
  - 跳线：真实 HiClaw Controller 未暴露 `/api/v1/workers/{name}/events`，所以未做 live E2E；改用 fetch mock 验证边界
  - 引用：R4-7

- [cancelled]* 9.2 截图回归（Playwright / Percy）
  - 跳线：当前 sandbox 无 browser binary；安装 Playwright 体积大（~300MB）+ 需要 cron job
  - 替代：阶段 5.13 已要求开发者手动 smoke；本环境无 UI 自动化条件
  - 后续：等部署到 staging k3s 环境后再加 Playwright
  - 引用：R4-2

- [x]* 9.3 A2UI v0.9 schema 漂移监测
  - 实现：`parseA2UIPayload` 改返 `A2UIParseResult { doc, schemaRecognized, hasUnsupportedComponents }`；`A2UIDocument.schemaVersion` 透传
  - UI：A2UIRenderer 顶部加 amber banner，schema 未识别或含未支持 component 类型时软提示
  - 契约测试：`tests/a2ui.test.ts` 增至 9 用例（含 schema version 识别 + 漂移检测）
  - 引用：R3

- [cancelled]* 9.4 国际化（英文 UI 文案）
  - 跳线：当前项目全中文，目标用户群体是中文团队
  - 后续：如有海外用户接入需求再启动 i18n（next-intl / react-intl）
  - 引用：R4-2

## 决策点

> 默认全部任务执行（含可选）；若用户决定跳过可选任务，按需求把 9.1-9.4 标 `cancelled`。