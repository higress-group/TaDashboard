# TaDashboard 架构设计

## 概述

TaDashboard 是一个基于 **Next.js 16 + React 19 + TypeScript** 的单页 Web 应用，作为 [HiClaw Controller](https://github.com/higress-group/hiclaw) 的可视化操作控制台。它面向运维与平台工程师，用于集中管理一个 HiClaw 集群内的 **Worker、Team、Human、Manager、Gateway Consumer** 等核心资源，并通过 Matrix 协议接入聊天能力（房间、成员、消息）。

系统的核心设计是"**永远不直连后端**"：浏览器只与同源 Next.js 路由交互，Next.js 服务端再以代理身份访问 HiClaw Controller 与 Matrix Homeserver。这层代理承担认证注入、SSRF 防护、超时控制、错误信封标准化四件事。

主要用户场景：
- 通过 Overview 总览集群健康度（活跃 Worker、Team、Matrix 房间数、连接状态）
- 资源 CRUD：Workers（唤醒/休眠/确保就绪/删除）、Teams（成员/关联 Worker/Human）、Humans（卡片/表格双视图、权限级别）、Managers、Gateway Consumers
- 实时观察 Infrastructure 组件健康度（Controller、Matrix、Higress、MinIO、Kubernetes API）
- Matrix 聊天：房间列表、成员、消息收发
- 操作审计：所有破坏性变更通过 `/api/audit` 持久化到本地 SQLite
- 教学/演示：Security、Architecture、Skills、Runtime、Quickstart 五个静态分区讲清 HiClaw 概念

## 技术栈

**语言与运行时**
- TypeScript 5（`target: ES2017`，`strict: true`）
- Node.js 20+（生产镜像 `node:20-alpine`）
- Bun 1.3+（本地开发可选，CI 用 npm）

**Web 框架**
- Next.js 16（`output: "standalone"`，App Router，Turbopack 构建）
- React 19
- TanStack Query 5（服务端状态）
- Zustand 5（客户端 store + persist 中间件）
- react-hook-form 7 + Zod 4（表单与校验）
- next-themes（暗色/亮色主题）

**UI**
- Tailwind CSS v4（`@tailwindcss/postcss`）
- shadcn/ui（基于 Radix UI 原语）
- framer-motion（页面/抽屉过渡）
- lucide-react（图标）
- recharts 3（概览图表）
- sonner（Toast）

**数据存储**
- SQLite + Prisma 6（仅 dashboard 本地状态：通知、审计、用户偏好、连接历史）
- 业务权威状态（Workers/Teams/Humans/...）由 HiClaw Controller 持有

**外部服务**
- HiClaw Controller（REST API，端口 8090）
- Matrix Homeserver（Client-Server API）
- Higress（API 网关，部署在 k3s 集群内）
- MinIO（包存储）
- Kubernetes API Server（in-cluster ServiceAccount 探针）

**质量工具**
- ESLint 9 + `eslint-config-next`（核心 + TS 规则）
- Vitest 2 + Vite 5（`css: { postcss: { plugins: [] } }` 避开根 PostCSS）
- TypeScript 严格模式，`next build` 同时做类型检查

## 项目结构

```
.
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # 根布局（Geist 字体、Toaster）
│   │   ├── page.tsx                      # 根入口：Theme/Query/Search/Dashboard Provider
│   │   ├── globals.css
│   │   └── api/
│   │       ├── route.ts                  # /api 根
│   │       ├── audit/route.ts            # POST 写入 / GET 读取 AuditLog
│   │       ├── hiclaw/
│   │       │   ├── proxy-helper.ts       # 共享：URL 校验、认证注入、超时、错误信封
│   │       │   ├── healthz/route.ts      # 本地进程探针（永远返回 "ok"）
│   │       │   ├── cluster-status/route.ts
│   │       │   ├── status/route.ts
│   │       │   ├── version/route.ts
│   │       │   ├── infrastructure/route.ts  # 聚合 5 个组件健康度
│   │       │   ├── workers/{route,[name]/{route,wake,sleep,ensure-ready,status}}/...
│   │       │   ├── teams/{route,[name]}/route.ts
│   │       │   ├── humans/{route,[name]}/route.ts
│   │       │   ├── managers/{route,[name]}/route.ts
│   │       │   ├── packages/route.ts
│   │       │   └── gateway/consumers/{route,[id]/{route,bind}}/route.ts
│   │       └── matrix/
│   │           ├── proxy-helper.ts       # homeserver 校验、token 注入、错误信封
│   │           ├── login/route.ts
│   │           ├── sync/route.ts
│   │           ├── joined-rooms/route.ts
│   │           └── rooms/[roomId]/{messages,send,state,members}/route.ts
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── hi-claw-dashboard.tsx     # 根壳：sidebar、顶栏、section 懒加载
│   │   │   ├── connection-banner.tsx     # 失联横幅（UNAUTHORIZED/FORBIDDEN 提示）
│   │   │   ├── settings-dialog.tsx
│   │   │   ├── notification-popover.tsx
│   │   │   ├── section-error-boundary.tsx
│   │   │   ├── section-header.tsx
│   │   │   ├── status-dot.tsx
│   │   │   ├── truncated-id.tsx
│   │   │   ├── copy-button.tsx
│   │   │   ├── api-error-state.tsx
│   │   │   ├── dashboard-data.ts
│   │   │   └── sections/                 # 13 个功能区组件（懒加载）
│   │   │       ├── overview-section.tsx
│   │   │       ├── workers-section.tsx
│   │   │       ├── teams-section.tsx
│   │   │       ├── humans-section.tsx
│   │   │       ├── managers-section.tsx
│   │   │       ├── chat-section.tsx
│   │   │       ├── infrastructure-section.tsx
│   │   │       ├── k8s-section.tsx
│   │   │       ├── skills-section.tsx
│   │   │       ├── architecture-section.tsx
│   │   │       ├── security-section.tsx
│   │   │       ├── runtime-section.tsx
│   │   │       └── quickstart-section.tsx
│   │   └── ui/                           # shadcn/ui 基础组件
│   ├── hooks/                            # TanStack Query hooks 与小工具 hooks
│   │   ├── use-hiclaw-{workers,teams,humans,managers,consumers,status,version,cluster-status,infrastructure,worker-detail,mutations}.ts
│   │   ├── use-matrix.ts
│   │   ├── use-toast.ts
│   │   ├── use-mobile.ts
│   │   └── use-counter.ts
│   └── lib/
│       ├── api-errors.ts                 # ApiErrorCode 体系 + ApiClientError + describeApiError
│       ├── audit.ts                      # 客户端 recordAudit() 写入器
│       ├── db.ts                         # PrismaClient 单例
│       ├── hiclaw-api.ts                 # 浏览器调用的 HiClaw API 客户端
│       ├── hiclaw-store.ts               # Zustand：连接状态、controllerUrl、auto-reconnect
│       ├── matrix-api.ts                 # Matrix Client-Server API 客户端
│       ├── matrix-store.ts               # Zustand：token 持久化策略（session/local/none）
│       ├── notification-store.ts         # Zustand：内存通知（最多 50 条）
│       ├── phase-colors.ts
│       ├── query-provider.tsx
│       ├── search-context.tsx
│       └── utils.ts                      # cn() Tailwind 合并
├── prisma/
│   └── schema.prisma                     # 4 张表：Notification/ConnectionAttempt/UserPreference/AuditLog
├── public/                               # 静态资源
├── tests/                                # 跨切片测试
│   ├── api-errors.test.ts                # 10 tests
│   ├── audit.test.ts                     # 4 tests
│   ├── hiclaw-api.test.ts                # 10 tests
│   ├── matrix-proxy-helper.test.ts       # 7 tests
│   └── matrix-store.test.ts              # 7 tests
├── deploy/k3s/                           # k3s 部署清单（kustomize，Higress 入口）
├── scripts/                              # mock-hiclaw / install-higress / deploy-k3s / teardown-k3s / build-and-load-image
├── mock/                                 # 本地 mock Controller 文档
├── k8s/                                  # 旧版单文件部署清单（保留兼容）
├── docs/                                 # 用户文档（k3s-deployment.md）
├── examples/                             # 早期示例（已从 TS 编译中排除）
├── agent-ctx/                            # Agent 上下文
├── .zscripts/                            # 构建辅助
├── .github/ISSUE_TEMPLATE/               # bug_report / feature_request / config
├── Dockerfile                            # 多阶段：deps → builder → runner（非 root、healthcheck）
├── Caddyfile                             # 反向代理模板
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── components.json                       # shadcn/ui 配置
├── dev-server.sh / start-server.sh / keep-alive.sh / server-runner.mjs  # 本地辅助
├── .env.example / .env.k3s.example
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
└── worklog.md                            # 增量变更日志
```

**入口点**
- `src/app/page.tsx:1` — 根入口，挂载 `ThemeProvider` / `QueryProvider` / `SearchProvider` / `HiClawDashboard`
- `src/components/dashboard/hi-claw-dashboard.tsx:192` — 根壳，管理 active section（hash + localStorage）
- `src/app/api/hiclaw/proxy-helper.ts:77` — `proxyToHiClaw()`：所有 HiClaw 代理路由共享
- `src/app/api/matrix/proxy-helper.ts:64` — `proxyToMatrix()`：所有 Matrix 代理路由共享
- `src/lib/api-errors.ts:128` — `ApiClientError` 客户端错误包装

## 子系统

### 1. HiClaw 代理层
**目的**：浏览器不直连 Controller；所有请求通过 Next.js API 路由代理。
**位置**：`src/app/api/hiclaw/`
**关键文件**：`proxy-helper.ts`（181 行）、`infrastructure/route.ts`（聚合健康度）、`healthz/route.ts`（本地进程探针）
**依赖**：`src/lib/api-errors.ts`（错误信封）、`src/lib/hiclaw-api.ts`（类型）
**被依赖**：所有 `use-hiclaw-*` hook 都通过 `/api/hiclaw/*` 路径访问

### 2. Matrix 代理层
**目的**：浏览器不直连 Homeserver；服务端注入 `Authorization: Bearer <accessToken>`，避免 token 泄露到 HTTP referer。
**位置**：`src/app/api/matrix/`
**关键文件**：`proxy-helper.ts`（148 行）、`login/sync/rooms` 系列 route
**依赖**：`src/lib/matrix-api.ts`（类型）、`src/lib/matrix-store.ts`（token）
**被依赖**：`chat-section.tsx` 与 `use-matrix.ts`

### 3. 客户端状态
**目的**：Zustand stores 提供轻量客户端状态，跨组件共享，避免 React Context 的重渲染。
**位置**：`src/lib/{hiclaw-store,matrix-store,notification-store}.ts`
**关键文件**：
- `hiclaw-store.ts` — controllerUrl / isConnected / autoReconnect，**包含一段 module-level 的全局 `setInterval` 自动重连 effect**（在 `typeof window !== 'undefined'` 内订阅 store）
- `matrix-store.ts` — homeserver / accessToken / userId / deviceId，**支持三种 token 持久化策略**（`session` 默认 / `local` 旧兼容 / `none` 不存盘）
- `notification-store.ts` — 最多 50 条内存通知
**依赖**：`zustand` + `zustand/middleware` 中的 `persist` / `createJSONStorage`
**被依赖**：所有 section 组件、`use-hiclaw-status.ts`、`use-hiclaw-mutations.ts`

### 4. 数据获取层
**目的**：用 TanStack Query 包装所有 HiClaw 列表/详情/变异请求，统一缓存键、失效、错误。
**位置**：`src/hooks/use-hiclaw-*.ts` + `src/hooks/use-hiclaw-mutations.ts`
**关键文件**：
- `use-hiclaw-workers.ts` / `teams` / `humans` / `managers` / `consumers` — 列表查询，键名 `['hiclaw-<resource>']`
- `use-hiclaw-cluster-status.ts` / `infrastructure.ts` / `version.ts` / `status.ts` — 单点查询
- `use-hiclaw-mutations.ts`（409 行）— 13 个 mutation（CRUD + 状态机操作），**全部接入 `recordAudit` 与 `formatError`**
- `use-hiclaw-worker-detail.ts` — 单个 worker 详情
**依赖**：`@tanstack/react-query` + `src/lib/hiclaw-api.ts` + `src/lib/api-errors.ts` + `src/lib/audit.ts`
**被依赖**：13 个 `sections/*.tsx`

### 5. 审计与持久化
**目的**：所有破坏性 mutation 写入本地 SQLite 的 `AuditLog` 表，配合 Prisma 提供事后追溯。
**位置**：`src/lib/audit.ts` + `src/app/api/audit/route.ts` + `prisma/schema.prisma`
**关键文件**：
- `audit.ts`（44 行）— 浏览器侧 `recordAudit()`，**用 `keepalive: true` 保证 fetch 不被取消**
- `api/audit/route.ts`（111 行）— 17 个白名单 action 的 POST 写入 + GET 列表查询，Node runtime
- `prisma/schema.prisma` — 4 张表：Notification / ConnectionAttempt / UserPreference / **AuditLog**
**依赖**：`@prisma/client` + `better-sqlite3` driver
**被依赖**：所有 mutation 的 `onSuccess` 分支

### 6. 错误信封体系
**目的**：用一套稳定的错误码（`ApiErrorCode`）让 UI 能根据 `code` 切换提示与降级策略。
**位置**：`src/lib/api-errors.ts`（265 行）
**关键文件**：
- `statusToCode()` — HTTP 状态码 → ApiErrorCode
- `jsonErrorBody()` / `jsonErrorResponse()` — 构造标准错误信封 `{ error: { code, message, upstream?, details? } }`
- `isApiErrorBody()` — 客户端类型守卫
- `ApiClientError` — 客户端 Error 子类，可从 `Response` 构造
- `describeApiError()` — 把 code 翻译成 `{ title, description, actionable }` UI hint
**依赖**：无外部依赖
**被依赖**：所有 proxy route + 所有 client API + ConnectionBanner + formatError

### 7. UI 渲染
**目的**：单页应用，13 个 section 懒加载，sidebar + 顶栏布局。
**位置**：`src/components/dashboard/`
**关键文件**：
- `hi-claw-dashboard.tsx`（754 行）— 根壳，`useActiveSection()` 维护 hash + localStorage
- `connection-banner.tsx`（93 行）— 失联横幅，按 error code 切图标/文案
- `settings-dialog.tsx` — Controller URL、auto-reconnect 配置
- `notification-popover.tsx` — 通知列表
- `section-error-boundary.tsx` — 子树错误隔离
**依赖**：`framer-motion` / `next-themes` / `lucide-react` / `use-hiclaw-status`
**被依赖**：浏览器入口

## 关键流程

### 启动 + 首次连接
```
浏览器 → / (page.tsx) → ThemeProvider/QueryProvider/SearchProvider/HiClawDashboard
  → HiClawDashboard 渲染
  → useHiClawStatus() 触发 checkConnection()
    → /api/hiclaw/healthz?controllerUrl=...
      → 本地 200 "ok"（无 controller 也能跑通）
  → hiclaw-store 写入 isConnected=true + 连接历史
  → ConnectionBanner 不显示（已连）
```

### 写操作（创建 Worker）
```
User 点 "Create Worker" → workers-section.tsx 调 useCreateWorker()
  → hiclawApi.createWorker(data) → /api/hiclaw/workers POST
    → proxyToHiClaw() 注入 Authorization + 10s timeout
    → HiClaw Controller 创建资源，返回 201 WorkerResponse
  → TanStack Query 拿到数据
  → onSuccess:
      - invalidateQueries(['hiclaw-workers']) → 列表自动刷新
      - toast.success(...)
      - addNotification(...)
      - recordAudit({action:'worker.create', resource:'worker', resourceId:name, metadata:{runtime, model}})
        → fetch /api/audit POST keepalive
          → db.auditLog.create() 写入 SQLite
```

### 错误降级（鉴权失败）
```
Controller 返回 401 → proxyToHiClaw 解析为 UNAUTHORIZED → 标准化信封
  → hiclawApi.proxyRequest 抛 ApiClientError(code='UNAUTHORIZED')
  → useCreateWorker.onError 调 formatError(err) → describeApiError('UNAUTHORIZED') → "Token 缺失或已失效"
  → ConnectionBanner 重新拉健康检查时同样路径
  → banner 显示 ShieldAlert 图标 + "HiClaw Controller 鉴权失败" + describeApiError.description
```

### Matrix 聊天
```
User 登录 → matrix-store.login(homeserver, username, password)
  → /api/matrix/login POST → proxyToMatrix → 真实 Homeserver → 返回 access_token
  → 写入 useMatrixStore（持久化策略：session/local/none）
chat-section.tsx 拉取房间
  → matrixApi.getJoinedRooms() → /api/matrix/joined-rooms?homeserver=...&accessToken=...
    → proxyToMatrix 注入 Bearer token
```

## 设计决策

### 1. Next.js 作为反向代理而非纯前端
早期版本浏览器直连 Controller + Matrix。CORS、token 泄露、SSRF 都难治理。统一进 `/api/{hiclaw,matrix}/*` 后，鉴权与 allow-list 都收敛在一层（见 `proxy-helper.ts:10-19, 50-75, 9-18, 26-53`）。

### 2. ApiErrorCode 而不是裸 HTTP 状态码
前端不再 `if (res.status === 401)`，而是 `switch (err.code)`。code 跨后端实现稳定，状态码可以随代理映射（502/504/503 → UPSTREAM_UNAVAILABLE）。详见 `src/lib/api-errors.ts:34-44, 79-106`。

### 3. SQLite 仅做 dashboard 本地状态
Workers/Teams/Humans/Manager 权威状态在 Controller，dashboard 不做"本地副本"。本地 SQLite 只存四类东西：通知、连接历史、用户偏好、审计日志。`prisma/schema.prisma:4-6` 明确这一点。

### 4. TanStack Query + Zustand 分工
- TanStack Query：服务端状态（Controller 拉的数据），自带缓存/失效/重试
- Zustand：客户端临时状态（UI 偏好、连接状态、通知、token）
- 不用 Redux/Context：减少样板，避免不必要的 re-render

### 5. audit 写入 best-effort
`recordAudit()` 用 `keepalive: true` + 静默吞错（`src/lib/audit.ts:31-43`）。主流程不被审计失败阻塞。审计完整性靠监控 `/api/audit` 错误率保证，不在主流程上做"必须成功"的强约束。

### 6. Matrix token 持久化可配置
默认 `session`（关 tab 清除），`local`（旧兼容），`none`（不存盘）。`NEXT_PUBLIC_MATRIX_TOKEN_PERSIST` 控制。教学/演示场景用 `none`，个人单机用 `session`，旧迁移用 `local`。详见 `src/lib/matrix-store.ts:9-15, 17-41`。

### 7. k3s + Higress 而非 Traefik
HiClaw 把 Higress 当 API 网关（Consumer 凭证注入、限流、TLS），Traefik 是 k3s 默认 ingress controller。两者会抢端口 80/443 + 同一 `IngressClass`，**不能共存**。`deploy/k3s/41-hiclaw-ingress.yaml` 用 `ingressClassName: higress`，`scripts/install-higress.sh` 装 Higress，`scripts/deploy-k3s.sh` 部署前预检 Higress + 警告 Traefik。详见 `docs/k3s-deployment.md`。

### 8. 项目内嵌 mock Controller
`scripts/mock-hiclaw.mjs` 是零依赖 Node HTTP server，实现 dashboard 调用的所有端点（含错误信封），让本地 UI 演示与开发不依赖真实 Controller。`mock/README.md` 列端点。生产部署时用同一镜像跑这个 mock 当 Controller 占位，真 Controller 镜像就绪后改 `image:` 即可。

## 附录：关键文件速查

| 主题 | 路径 |
|---|---|
| 根入口 | `src/app/page.tsx` |
| 根壳 | `src/components/dashboard/hi-claw-dashboard.tsx` |
| 错误体系 | `src/lib/api-errors.ts` |
| HiClaw 客户端 API | `src/lib/hiclaw-api.ts` |
| Matrix 客户端 API | `src/lib/matrix-api.ts` |
| HiClaw 代理 helper | `src/app/api/hiclaw/proxy-helper.ts` |
| Matrix 代理 helper | `src/app/api/matrix/proxy-helper.ts` |
| HiClaw 连接 store | `src/lib/hiclaw-store.ts` |
| Matrix 登录 store | `src/lib/matrix-store.ts` |
| 审计 client | `src/lib/audit.ts` |
| 审计 server | `src/app/api/audit/route.ts` |
| Prisma schema | `prisma/schema.prisma` |
| k3s manifests | `deploy/k3s/` |
| k3s 部署文档 | `docs/k3s-deployment.md` |
| Mock Controller | `scripts/mock-hiclaw.mjs` |
| Dockerfile | `Dockerfile` |
| 通用配置 | `next.config.ts` / `tsconfig.json` / `eslint.config.mjs` / `vitest.config.ts` |
