# 开发者指南

## 项目目的

TaDashboard 是 HiClaw 集群的 Web 管理面板。它在更大系统里担任"操作控制台"角色：
- **后端权威状态**（Worker/Team/Human/Manager/Consumer 资源）由 HiClaw Controller 拥有
- **本地状态**（通知、连接历史、用户偏好、审计日志）由本应用用 SQLite 维护
- **聊天能力**通过 Matrix Homeserver 提供，与 Controller 解耦

**核心职责**：
- 把 Controller 的 REST API 渲染成可操作 UI
- 把 Matrix Client-Server API 渲染成聊天界面
- 标准化错误响应，让 UI 能根据错误码降级
- 持久化所有破坏性操作到本地审计日志

**相关系统**：
- [HiClaw Controller](https://github.com/higress-group/hiclaw) — 资源权威
- Matrix Homeserver — 聊天后端（自建 Tuwunel 或 SaaS）
- Higress — API 网关（仅在 k3s 部署）
- MinIO — 包存储（仅在 k3s 部署）

## 环境搭建

### 前置条件

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | 20+ | 运行时（生产镜像 `node:20-alpine`） |
| Bun | 1.3+（可选） | 本地开发更快 |
| npm | 10+ | 依赖安装与脚本运行 |
| Docker | 24+ | 构建镜像 / 跑 k3s 节点 |
| k3s | v1.31+ | k3s 部署（可选） |
| Helm | 3.10+ | 安装 Higress（可选） |
| sqlite3 CLI | — | 调试本地数据库 |

### 安装

```bash
git clone https://github.com/higress-group/TaDashboard
cd TaDashboard
npm install
# 或 bun install

# 准备环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 HICLAW_CONTROLLER_URL 等
```

### 环境变量

`.env.example` 完整模板（`.env.k3s.example` 用于 k3s 部署）：

| 变量 | 必需 | 描述 | 默认 |
|---|---|---|---|
| `DATABASE_URL` | 是 | Prisma SQLite 文件路径 | `file:./db/custom.db` |
| `HICLAW_CONTROLLER_URL` | 是 | 服务端访问 Controller 的 URL | `http://localhost:8090` |
| `NEXT_PUBLIC_HICLAW_CONTROLLER_URL` | 否 | 浏览器直连 Controller 的 URL（生产留空走代理） | 空 |
| `HICLAW_AUTH_TOKEN` | 否 | 静态 Bearer token | 空 |
| `HICLAW_AUTH_TOKEN_FILE` | 否 | projected SA token 文件路径 | `/var/run/secrets/hiclaw/token` |
| `HICLAW_MINIO_URL` | 否 | MinIO 健康探针地址 | `http://hiclaw-minio.hiclaw-system:9000` |
| `HICLAW_MATRIX_URL` | 否 | Matrix 健康探针地址 | `http://hiclaw-tuwunel.hiclaw-system:6167` |
| `HICLAW_AI_GATEWAY_URL` | 否 | Higress 健康探针地址 | `http://higress-gateway.hiclaw-system:80` |
| `NEXT_PUBLIC_MATRIX_API_URL` | 是 | Matrix homeserver 浏览器可见基础 URL | `http://localhost:6167` |
| `MATRIX_ALLOWED_HOSTS` | 否 | 逗号分隔的额外允许 homeserver | 空 |
| `NEXT_PUBLIC_MATRIX_TOKEN_PERSIST` | 否 | `session` / `local` / `none` | `session` |
| `ALLOWED_DEV_ORIGINS` | 否 | `next dev` 允许的来源，逗号分隔 | 空 |
| `NODE_ENV` | 否 | `development` / `production` | `development` |

> ⚠️ **绝不提交密钥**。`.env*` 已在 `.gitignore` 中被忽略。

### 初始化数据库

```bash
npm run db:push      # 用 schema.prisma 推送结构到 SQLite
# 或
npm run db:migrate   # 创建并应用迁移（推荐用于生产）

# 生成 Prisma Client（db:push 自动执行）
npm run db:generate
```

### 启动

```bash
# 开发服务器（端口 3000）
npm run dev

# 生产构建
npm run build
# 启动 standalone 服务
bun .next/standalone/server.js
# 或
npm start
```

### 测试

```bash
# 单元/集成测试
npm run test

# watch 模式
npm run test:watch

# 覆盖率
npm run test:coverage
```

**测试范围**（5 文件 38 用例）：
- `tests/api-errors.test.ts` — 10 个：错误码映射、错误信封构造、`ApiClientError.fromResponse`、UI hint
- `tests/audit.test.ts` — 4 个：POST 形状、缺省字段、网络/5xx 吞错
- `tests/hiclaw-api.test.ts` — 10 个：客户端 API 的成功/错误路径
- `tests/matrix-store.test.ts` — 7 个：session/local/none 三种持久化
- `tests/matrix-proxy-helper.test.ts` — 7 个：homeserver allow-list

## 开发工作流

### 代码质量工具

| 工具 | 命令 | 目的 |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 类型检查（next build 也会跑） |
| ESLint | `npm run lint` | 代码风格与潜在问题 |
| Vitest | `npm run test` | 单元/集成测试 |
| Prettier | （未配置） | — |

### ESLint 规则

`eslint.config.mjs` 关闭了一组规则，包括：
- 全部 React Hooks 规则（`exhaustive-deps` / `purity` / `set-state-in-effect` / `refs`）— 旧代码不动，新规则一律豁免
- `@typescript-eslint/no-explicit-any` 等 TS 严格规则 — 关闭以避免大型 codebase 全改
- `no-console` / `no-debugger` / `no-unused-vars` — 关闭

**不要**主动加严这些规则，除非明确知道影响范围。

### 提交规范

仓库无 commit-msg 强制，但**建议** Conventional Commits：
```
feat(scope): short summary
fix(scope): short summary
chore(scope): short summary
refactor(scope): short summary
test(scope): short summary
docs(scope): short summary
```

**不要**自动提交。Agent 默认不 commit，由用户手动 `git add && git commit && git push`。

### 提交前自检

```bash
# 一次性跑完三个质量门禁
npm run lint
npm run test
npm run build
```

三条全绿才能提 PR。

## 常见任务

### 添加新的 HiClaw 资源类型

假设新增一种资源 `HiclawWidget`：

1. **类型定义**：`src/lib/hiclaw-api.ts`
   ```typescript
   export interface WidgetResponse { name: string; phase: string; /* ... */ }
   export interface CreateWidgetRequest { name: string; }
   export interface UpdateWidgetRequest { /* partial */ }
   ```
2. **客户端方法**：在 `hiclawApi` 对象上添加 `listWidgets` / `getWidget` / `createWidget` / `updateWidget` / `deleteWidget`
3. **代理路由**：`src/app/api/hiclaw/widgets/{route,[name]/route.ts}`，调用 `proxyToHiClaw()`
4. **Hook**：`src/hooks/use-hiclaw-widgets.ts`（列表）+ `use-hiclaw-mutations.ts`（变异）
5. **审计**：`src/lib/audit.ts` 的 `AuditAction` 加 `widget.create` / `widget.update` / `widget.delete`；`src/app/api/audit/route.ts` 的 `ALLOWED_ACTIONS` 同步加
6. **Section 组件**：`src/components/dashboard/sections/widgets-section.tsx` + `hi-claw-dashboard.tsx` 的 `sectionMap` 加映射 + `navItems` 加菜单
7. **测试**：`tests/hiclaw-api.test.ts` 加成功/错误用例
8. **文档**：在 `INTERFACES.md` 加端点行；在 `ARCHITECTURE.md` 子系统 1 加端点链接

### 添加新的 Matrix 操作

例如发送带附件消息：

1. **类型**：`src/lib/matrix-api.ts` 加 `sendAttachment()`，扩展 `sendMessage` options
2. **代理路由**：`src/app/api/matrix/rooms/[roomId]/send/route.ts` 支持 multipart
3. **Hook/UI**：`src/hooks/use-matrix.ts` 加 mutation；`chat-section.tsx` 调用

### 添加新的审计 Action

例如 `worker.restart`：

1. `src/lib/audit.ts:4-21` 的 `AuditAction` union 加 `'worker.restart'`
2. `src/app/api/audit/route.ts:5-23` 的 `ALLOWED_ACTIONS` Set 同步加
3. 任何发起的 mutation 中 `recordAudit({ action: 'worker.restart', ... })`
4. `tests/audit.test.ts` 增加对应 payload 验证（如有断言覆盖）

**两端必须同步**，否则 POST `/api/audit` 会返回 `BAD_REQUEST: Unsupported audit action`。

### 添加新的 ApiErrorCode

例如 `QUOTA_EXCEEDED`：

1. `src/lib/api-errors.ts:7-19` union 加 `'QUOTA_EXCEEDED'`
2. `statusToCode()` 加状态码映射（如 402）
3. `statusToCodeToStatus()` 加 HTTP 状态（如 402）
4. `describeApiError()` 加分支返回 `{ title, description, actionable }`
5. `tests/api-errors.test.ts` 加覆盖
6. `docs/INTERFACES.md` 错误码表加一行

### 修改 Dashboard Sidebar 菜单

编辑 `src/components/dashboard/hi-claw-dashboard.tsx:90-104` 的 `navItems` 数组。`id` 必须与 `sectionMap` 的 key 对应（`hi-claw-dashboard.tsx:106-120`）。

### 修改持久化的 Controller URL

`src/lib/hiclaw-store.ts:66-69` 默认值；`persist` 配置在 `src/lib/hiclaw-store.ts:159-167` 的 `partialize`，决定哪些字段写到 localStorage。

## 编码规范

### 文件组织

- 一个文件一个主组件/类/函数
- 公共组件放在 `src/components/`（业务组件 `dashboard/`，基础 UI `ui/`）
- Section 组件放在 `src/components/dashboard/sections/`
- 跨切片 hooks 放在 `src/hooks/`（带 `use-` 前缀）
- 客户端 store/工具/类型放在 `src/lib/`
- API 路由按资源组织在 `src/app/api/<resource>/`

### 命名

| 类型 | 约定 | 示例 |
|---|---|---|
| 文件（kebab-case） | 资源-动作 | `use-hiclaw-workers.ts` |
| 组件（PascalCase） | 资源+Section | `WorkersSection` |
| 函数（camelCase） | 动词+名词 | `checkConnection` |
| 常量（SCREAMING_SNAKE） | 全大写 | `MAX_HISTORY`, `TIMEOUT_MS` |
| 类型（PascalCase） | 名词 | `WorkerResponse`, `ApiErrorCode` |
| Hook（camelCase） | `use`+动词 | `useWorkers`, `useCreateWorker` |

### 错误处理

```typescript
// 推荐：抛 ApiClientError
throw await ApiClientError.fromResponse(res, 'hiclaw', path);

// 推荐：在 UI 用 describeApiError 翻译
const { title, description } = formatError(err);
toast.error(`${title} · 操作失败: ${description}`);

// 避免：抛裸 Error 字符串
throw new Error('something failed');
```

### 测试约定

- **位置**：跨切片工具放 `tests/`，组件/hook 自带的 vitest 文件可放 `src/hooks/*.test.ts`（vitest 配置已包含 `src/**/*.test.ts`）
- **覆盖**：新公共函数必须有单测
- **API 客户端**：`tests/hiclaw-api.test.ts` 风格：mock `fetch`，断言抛 `ApiClientError` 用 `toMatchObject({ name: 'ApiClientError', code: 'FORBIDDEN' })`
- **错误信封**：`tests/api-errors.test.ts` 风格：纯函数直接测
- **持久化**：`tests/matrix-store.test.ts` 风格：注入 fake storage shim

## 构建与发布

### 本地构建

```bash
npm run build
# 产物在 .next/standalone/（自包含 server.js + node_modules）
bun .next/standalone/server.js
```

`build` 脚本还会把 `.next/static` 和 `public/` 复制到 standalone 目录。

### Docker 镜像

```bash
docker build -t hiclaw-dashboard:dev .
docker run --rm -p 3000:3000 hiclaw-dashboard:dev
```

多阶段：`deps`（npm install）→ `builder`（prisma generate + next build）→ `runner`（`node:20-alpine` + 非 root 用户 `nextjs:1001`，healthcheck 用 curl 探 `/`）。

### k3s 部署

详见 `docs/k3s-deployment.md`：

1. `curl -sfL https://get.k3s.io | sh -s - --disable=traefik`（**必须**禁 Traefik）
2. `scripts/install-higress.sh`（装 Higress）
3. `scripts/build-and-load-image.sh`（构建镜像导入 k3s containerd）
4. `scripts/deploy-k3s.sh`（kubectl apply -k deploy/k3s + 等 rollout）

## 排错

### TypeScript 类型错

- `use-hiclaw-mutations.ts` 用了 `as unknown as Record<string, unknown>` 而不是 `as Record<string, unknown>`：React 19 / 严格模式不允许无重叠断言
- chart 组件用了 `payload?: any[]` 而非 `recharts` 的 `TooltipProps`：`recharts@3` 改动了类型

### `bun` 不可用

CI 沙箱用 `node 20` + `npm`。`vitest@2` 必须显式安装 `vite@^5` 才不会报 PostCSS `plugins[0]` 错；`vitest.config.ts` 用 `css: { postcss: { plugins: [] } }` 解决 vite 读取根 `postcss.config.mjs`。

### `recordAudit` 测试需要 `window`

`recordAudit` 内部 `if (typeof window === 'undefined') return`，node vitest 环境无 window。在测试中用 `vi.stubGlobal('window', {})` 模拟。

### `package-lock.json` 与 `bun.lock` 冲突

`.gitignore` 忽略 `package-lock.json`，仓库统一 `bun.lock`。

### k3s 端口冲突

HiClaw 用 Higress 而非 Traefik。如果 Traefik 还在跑（k3s 默认），Higress 绑不到 80/443。处理：见 `docs/k3s-deployment.md` "Why disable Traefik" 章节。
