# 接口文档

TaDashboard 通过三层接口与外界交互：

1. **浏览器 → Next.js API 路由**（同源代理，外部代码不会直接调用）
2. **Next.js → HiClaw Controller**（同集群 in-cluster，端口 8090）
3. **Next.js → Matrix Homeserver**（同集群或外网，端口 6167）
4. **内部契约**：错误信封、AuditAction 枚举、AuditLog 表 schema

> 浏览器**不**直接访问 Controller 或 Homeserver。所有出站请求都先到 `/api/{hiclaw,matrix}/*`。

---

## 1. Next.js API 路由（浏览器 ↔ 代理）

> 完整清单见 `src/app/api/`。以下仅列**面向浏览器的端点**。

### HiClaw 代理

| 方法 | 路径 | 上游 | 用途 |
|---|---|---|---|
| GET | `/api/hiclaw/healthz` | （本地探针） | 始终返回 `text/plain "ok"`；供 ConnectionBanner 与 Kubernetes liveness/readiness 探针使用 |
| GET | `/api/hiclaw/cluster-status` | `GET /cluster-status` | 聚合计数 `{ kubeMode, totalWorkers, totalTeams, totalHumans }` |
| GET | `/api/hiclaw/status` | `GET /status` | 详细集群状态 |
| GET | `/api/hiclaw/version` | `GET /version` | `{ controller, kubeMode }` |
| GET | `/api/hiclaw/infrastructure` | （5 路并行健康探针） | 5 个组件健康度，原生实现而非代理 |
| GET | `/api/hiclaw/workers` | `GET /workers` | 列表（接受数组或 `{workers, total}` 两种形状） |
| POST | `/api/hiclaw/workers` | `POST /workers` | 创建 |
| GET | `/api/hiclaw/workers/{name}` | `GET /workers/{name}` | 详情 |
| PUT | `/api/hiclaw/workers/{name}` | `PUT /workers/{name}` | 更新 |
| DELETE | `/api/hiclaw/workers/{name}` | `DELETE /workers/{name}` | 删除，返回 204 |
| POST | `/api/hiclaw/workers/{name}/wake` | `POST /workers/{name}/wake` | 唤醒，返回 `{name, phase}` |
| POST | `/api/hiclaw/workers/{name}/sleep` | `POST /workers/{name}/sleep` | 休眠 |
| POST | `/api/hiclaw/workers/{name}/ensure-ready` | `POST /workers/{name}/ensure-ready` | 确保就绪 |
| GET | `/api/hiclaw/workers/{name}/status` | `GET /workers/{name}/status` | 状态详情 |
| GET/POST | `/api/hiclaw/teams[/{name}]` | 透传 | 团队 CRUD（PUT/DELETE 详情/列表/创建） |
| GET/POST | `/api/hiclaw/humans[/{name}]` | 透传 | 用户 CRUD |
| GET/POST | `/api/hiclaw/managers[/{name}]` | 透传 | Manager CRUD |
| POST | `/api/hiclaw/packages` | 透传（multipart） | 包上传，返回 `{ packageUri }` |
| GET | `/api/hiclaw/gateway/consumers` | 透传 | 列表 |
| POST | `/api/hiclaw/gateway/consumers` | 透传 | 创建 |
| DELETE | `/api/hiclaw/gateway/consumers/{id}` | 透传 | 删除 |
| POST | `/api/hiclaw/gateway/consumers/{id}/bind` | 透传 | 绑定 |

请求示例（带 `?controllerUrl=` 时需在 allow-list 内）：

```bash
curl 'http://localhost:3000/api/hiclaw/workers?controllerUrl=http://hiclaw-controller.hiclaw-system:8090'
```

### Matrix 代理

| 方法 | 路径 | 上游 | 用途 |
|---|---|---|---|
| POST | `/api/matrix/login` | `{homeserver}/_matrix/client/v3/login` | 登录，body `{ homeserver, username, password }` |
| GET | `/api/matrix/sync` | `{homeserver}/_matrix/client/v3/sync` | 长轮询同步 |
| GET | `/api/matrix/joined-rooms` | `{homeserver}/_matrix/client/v3/joined_rooms` | 已加入房间列表 |
| GET | `/api/matrix/rooms/{roomId}/messages` | `.../rooms/{roomId}/messages` | 拉消息 |
| GET | `/api/matrix/rooms/{roomId}/members` | `.../rooms/{roomId}/members` | 成员 |
| GET | `/api/matrix/rooms/{roomId}/state` | `.../rooms/{roomId}/state` | 房间状态事件 |
| PUT | `/api/matrix/rooms/{roomId}/send` | `.../rooms/{roomId}/send/{type}/{txnId}` | 发送消息 |

每个 Matrix 端点（除 login）要求 `?homeserver=...&accessToken=...` 或 `Authorization: Bearer <token>` 头部。`homeserver` 必须在 `MATRIX_ALLOWED_HOSTS` 或内置 allow-list 内。

### 审计 API

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/audit` | 写入 AuditLog 记录。Body 必填 `action`（17 个白名单之一）+ `resource`；可选 `resourceId` / `actor` / `metadata`（对象会被 `JSON.stringify`） |
| GET | `/api/audit?limit=50&resource=worker` | 读取最近 AuditLog 记录，`limit` 1-200，默认 50，可按 `resource` 过滤 |

写入示例：

```bash
curl -X POST http://localhost:3000/api/audit \
  -H 'content-type: application/json' \
  -d '{"action":"worker.create","resource":"worker","resourceId":"alice","metadata":{"runtime":"openclaw","model":"sonnet"}}'
```

成功响应：`{ "id": "<cuid>" }`。

---

## 2. Next.js → HiClaw Controller（服务端代理）

所有由 `src/app/api/hiclaw/*` 路由发起的请求。

**协议**：HTTP/1.1，路径 = URL 段与代理路径相同（如 `/api/hiclaw/workers` → Controller 的 `/workers`）。

**认证**：服务端在 `src/app/api/hiclaw/proxy-helper.ts:103-108` 注入 `Authorization: Bearer <token>`。token 来源优先级：
1. `process.env.HICLAW_AUTH_TOKEN`（直接配置）
2. `process.env.HICLAW_AUTH_TOKEN_FILE` 指向的文件（projected SA token，**每次请求重新读取**以支持轮转）
3. 浏览器 `Authorization` 头部（仅当以上两者都为空时回退）

**超时**：`TIMEOUT_MS = 10000`（`src/app/api/hiclaw/proxy-helper.ts:6`）。

**SSRF 防护**：`?controllerUrl=` 参数的 hostname 必须在 allow-list（`src/app/api/hiclaw/proxy-helper.ts:10-19`）：
```
localhost, 127.0.0.1, 0.0.0.0, ::1,
hiclaw-controller, hiclaw-controller.hiclaw-system,
hiclaw-controller.hiclaw-system.svc,
hiclaw-controller.hiclaw-system.svc.cluster.local
```
或以 `.svc` / `.svc.cluster.local` / `.cluster.local` / `.local` 结尾。验证失败时回退到 `HICLAW_CONTROLLER_URL` 默认值。

**Multipart 透传**：`/api/hiclaw/packages` 走 `multipart/form-data` 路径，复制原始 `Content-Type` 头部（`src/app/api/hiclaw/proxy-helper.ts:111-119`），不重新设 boundary。

---

## 3. Next.js → Matrix Homeserver（服务端代理）

所有由 `src/app/api/matrix/*` 路由发起的请求。

**协议**：HTTP/1.1，`/api/matrix/{path}` 末尾直接拼到 `homeserver`。

**认证**：服务端在 `src/app/api/matrix/proxy-helper.ts:85-88` 注入 `Authorization: Bearer <accessToken>`。token 来自 query string `?accessToken=` 或 `Authorization` 头部（`src/app/api/matrix/proxy-helper.ts:55-62`）。

**超时**：`TIMEOUT_MS = 30000`（Matrix sync 可能长轮询）。

**SSRF 防护**：`?homeserver=` 参数的 hostname 必须在 allow-list（`src/app/api/matrix/proxy-helper.ts:9-18`）：
```
localhost, 127.0.0.1, 0.0.0.0, ::1,
matrix, matrix.hiclaw-system, matrix.hiclaw-system.svc,
matrix.hiclaw-system.svc.cluster.local
```
或以 `.svc` / `.svc.cluster.local` / `.cluster.local` / `.local` 结尾。运行时可通过 `MATRIX_ALLOWED_HOSTS` 扩展（逗号分隔）。

---

## 4. 错误信封契约

所有非 2xx 响应（无论来自 Next.js 路由还是上游）都标准化为：

```typescript
interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    upstream?: {
      status?: number;
      service: 'hiclaw' | 'matrix';
      path?: string;
    };
  };
}
```

`ApiErrorCode` 完整枚举（`src/lib/api-errors.ts:7-19`）：

| Code | HTTP 状态 | 含义 |
|---|---|---|
| `BAD_REQUEST` | 400 | 客户端参数错 |
| `UNAUTHORIZED` | 401 | 鉴权失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源冲突 |
| `RATE_LIMITED` | 429 | 触发限流 |
| `UPSTREAM_TIMEOUT` | 504 | 上游响应超时（`AbortError`） |
| `UPSTREAM_UNAVAILABLE` | 502 | 上游连接失败 / 502/503/504 |
| `UPSTREAM_ERROR` | 502 | 上游返回 5xx |
| `INVALID_RESPONSE` | 502 | 上游返回非预期格式（不是 JSON） |
| `CONFIGURATION_ERROR` | 500 | 服务端配置缺失/非法 |
| `INTERNAL_ERROR` | 500 | 内部错误 |

`upstream` 字段记录上游上下文。客户端 `ApiClientError.fromResponse()` 解析该信封并抛出 `ApiClientError` 实例，前端用 `describeApiError(code)` 翻译成 UI hint。

### 错误响应示例

Controller 返回 401：
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "token expired",
    "upstream": { "service": "hiclaw", "status": 401, "path": "/workers" }
  }
}
```

Controller 不可达：
```json
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "fetch failed",
    "upstream": { "service": "hiclaw", "path": "/workers" }
  }
}
```

---

## 5. 审计契约

### AuditAction 白名单

`src/lib/audit.ts:4-21` 与 `src/app/api/audit/route.ts:5-23` 保持一致：

| 资源 | Action 列表 |
|---|---|
| Worker | `worker.create` / `update` / `delete` / `wake` / `sleep` / `ensure-ready` |
| Team | `team.create` / `update` / `delete` |
| Human | `human.create` / `update` / `delete` |
| Manager | `manager.create` / `update` / `delete` |
| Gateway Consumer | `consumer.create` / `delete` |

### AuditLog 表

`prisma/schema.prisma:51-62`：

| 列 | 类型 | 索引 | 描述 |
|---|---|---|---|
| `id` | String (cuid) | PK | 主键 |
| `action` | String | `createdAt` | AuditAction 字符串 |
| `resource` | String | `resource, resourceId` | 资源类型 |
| `resourceId` | String? | 同上 | 资源名/ID |
| `actor` | String? | — | 触发者（通常为浏览器 session user） |
| `metadata` | String? | — | `JSON.stringify` 后的对象，存 runtime/model/leader 等上下文 |
| `createdAt` | DateTime | `createdAt` | 默认 `now()` |

### 客户端写入器

`src/lib/audit.ts:31-43`：

```typescript
recordAudit({
  action: 'worker.delete',
  resource: 'worker',
  resourceId: 'alice',
  actor: 'admin@hiclaw.local',         // 可选
  metadata: { runtime: 'openclaw' },  // 可选，对象会被 JSON.stringify
});
```

行为：
- 在 SSR（`typeof window === 'undefined'`）下直接返回，不发请求
- 失败（网络错或非 2xx）静默吞掉，**不阻塞**主流程
- `keepalive: true` 保证 `pagehide` 后仍能完成
- 若设置了 `NEXT_PUBLIC_AUDIT_WRITE_TOKEN`，自动注入 `Authorization: Bearer ...` 头

### Audit 鉴权与大小限制（`src/app/api/audit/route.ts`）

| 项 | 限制 |
|---|---|
| 鉴权 | `AUDIT_WRITE_TOKEN` env 设了则需要 `Authorization: Bearer <token>` 或 `X-Audit-Token: <token>`；未设 token 时**默认拒绝所有写读** |
| `resource` | 必填，1-256 字符 |
| `resourceId` / `actor` | 可选，最多 256 字符 |
| `metadata` | 对象或字符串；对象最多 32 个键、4 层嵌套、序列化后 ≤ 8192 字节；序列化时检测循环引用 |
| 写入失败 | 5xx 返回 `UPSTREAM_ERROR`/`INTERNAL_ERROR` 错误信封 |

默认拒绝策略：未配置 `AUDIT_WRITE_TOKEN` 时所有 POST/GET 返回 `401 UNAUTHORIZED`，防止部署时忘记配置导致审计被任意访问。

### 失败审计（Bug 3 修复）

每个 mutation 的 `onError` 也会调用 `recordAudit`，复用同一 action 名，metadata 加：

```typescript
metadata: { outcome: 'failure', code: 'FORBIDDEN', error: '<message truncated to 200 chars>' }
```

这样合规审计能查到所有"未遂"操作。

---

## 6. 客户端 Store 契约

### HiClaw 连接 store（`src/lib/hiclaw-store.ts`）

```typescript
interface HiClawState {
  controllerUrl: string;          // 持久化
  isConnected: boolean;           // 内存
  connectionError:                // 失联时的分类错误
    | { code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN'; message: string }
    | null;
  isChecking: boolean;            // 当前是否在 health check
  settingsOpen: boolean;
  autoReconnect: boolean;         // 持久化
  reconnectInterval: number;      // 持久化，毫秒
  lastConnectedAt: number | null; // 持久化
  connectionLatency: number | null;
  connectionHistory: ConnectionAttempt[];  // 最近 5 条
  // ...actions
}
```

`checkConnection()` 流程：
1. `set({ isChecking: true, connectionError: null })`
2. `fetch('/api/hiclaw/healthz?controllerUrl=...')`
3. 响应 `200 + text/plain "ok"` → 标记成功，写入历史
4. 响应非 2xx → `readErrorInfo()` 解析错误信封，写入 `connectionError`
5. fetch 抛错 → `connectionError = { code: 'NETWORK_ERROR', message }`
6. 每次 `set` 后 `connectionHistory` 截断到 5 条

**自动重连**：模块顶层（`src/lib/hiclaw-store.ts:202-219`）订阅 store 变化，条件 `(autoReconnect && !isConnected && !settingsOpen)` 启动 `setInterval(checkConnection, reconnectInterval)`。

### Matrix token 持久化策略（`src/lib/matrix-store.ts`）

`NEXT_PUBLIC_MATRIX_TOKEN_PERSIST` 取值：

| 值 | 行为 |
|---|---|
| `session`（默认） | sessionStorage |
| `local` | localStorage（旧版兼容） |
| `none` | 内存（每次刷新清空，公共终端安全） |

`resolvePersistMode()` 在模块加载时一次性解析。`__testing_createMatrixStorage` 导出供测试用。

---

## 7. Hooks 接口

`src/hooks/` 下的所有 hook 都遵循统一约定：

```typescript
// 查询
const { data, isLoading, error, refetch } = useWorkers();
// 内部使用 queryKey: ['hiclaw-workers']，staleTime: 10s（来自 QueryProvider）

// 变异
const mutation = useCreateWorker();
mutation.mutate({ name: 'alice', runtime: 'openclaw', model: 'sonnet' });
// onSuccess 自动 invalidate 相关 queryKey + toast + 通知 + recordAudit
// onError 自动 formatError(err) → toast + 通知
```

完整 hook 清单：

| Hook | 用途 | 失效键 |
|---|---|---|
| `useWorkers` | Worker 列表 | `['hiclaw-workers']` |
| `useTeams` | Team 列表 | `['hiclaw-teams']` |
| `useHumans` | Human 列表 | `['hiclaw-humans']` |
| `useManagers` | Manager 列表 | `['hiclaw-managers']` |
| `useConsumers` | Gateway Consumer 列表 | `['hiclaw-consumers']` |
| `useWorkerDetail(name)` | 单个 Worker | `['hiclaw-worker-detail', name]` |
| `useClusterStatus` | 聚合计数 | `['hiclaw-cluster-status']` |
| `useInfrastructure` | 5 组件健康 | `['hiclaw-infrastructure']` |
| `useVersion` | Controller 版本 | `['hiclaw-version']` |
| `useHiClawStatus` | 连接状态 | （直接读 store） |
| `useCreateWorker/Team/...` | 变异 | （各自失效） |
| `useUpdateWorker/Team/...` | 变异 | |
| `useDeleteWorker/Team/...` | 变异 + recordAudit | |
| `useWakeWorker/SleepWorker/EnsureReadyWorker` | 状态机 | |
| `useCreateConsumer/DeleteConsumer/BindConsumer` | Gateway 变异 + recordAudit | |

---

## 8. 安全注意事项

- 浏览器**不**持有任何 Controller 凭据；Controller 鉴权由服务端 `HICLAW_AUTH_TOKEN` 或 projected token 处理
- Matrix accessToken 可在浏览器持久化（视 `NEXT_PUBLIC_MATRIX_TOKEN_PERSIST` 而定），但只通过 query string 或 Authorization 头部传给 Next.js 代理
- 全局 `Access-Control-Allow-Origin: *` 已被移除（`next.config.ts:11-14` 注释明示）；CORS 由 Ingress/Higress 层处理
- 浏览器**不**直接访问 Controller URL；`NEXT_PUBLIC_HICLAW_CONTROLLER_URL` 在生产环境留空，所有请求都走 Next.js 代理
- SSRF 防护在 `proxy-helper.ts` 双层（HiClaw + Matrix），allow-list 加 `*.svc.cluster.local` 等通配
- `recordAudit` 的 metadata 会落 SQLite 持久化，**不要在 metadata 中放密钥或密码**
