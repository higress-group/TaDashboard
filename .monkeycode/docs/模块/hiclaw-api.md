# src/lib/hiclaw-api.ts

HiClaw Controller 的客户端 API 层。所有请求通过 Next.js 代理路由 `/api/hiclaw/*`，由 `proxyRequest()` 统一包装。

## 公开 API

### 类型（资源响应）

| 类型 | 来源行 |
|---|---|
| `WorkerResponse` / `CreateWorkerRequest` / `UpdateWorkerRequest` | `hiclaw-api.ts:21-117` |
| `TeamResponse` / `CreateTeamRequest` / `UpdateTeamRequest` | `hiclaw-api.ts:41-136` |
| `HumanResponse` / `CreateHumanRequest` / `UpdateHumanRequest` | `hiclaw-api.ts:61-155` |
| `ManagerResponse` / `CreateManagerRequest` / `UpdateManagerRequest` | `hiclaw-api.ts:77-168` |
| `ConsumerResponse` / `CreateConsumerRequest` | `hiclaw-api.ts:170-179` |
| `ClusterStatus` / `VersionInfo` / `InfrastructureInfo` | `hiclaw-api.ts:181-199` |
| `ExposedPort` / Phase / State / Runtime enums | `hiclaw-api.ts:8-19` |

### API 客户端对象

```typescript
export const hiclawApi = {
  // Health
  checkHealth: (controllerUrl: string) => Promise<string>,
  getStatus: () => Promise<ClusterStatus>,
  getVersion: () => Promise<VersionInfo>,

  // Workers
  listWorkers: () => Promise<WorkerResponse[]>,
  getWorker: (name: string) => Promise<WorkerResponse>,
  createWorker: (data: CreateWorkerRequest) => Promise<WorkerResponse>,
  updateWorker: (name: string, data: UpdateWorkerRequest) => Promise<WorkerResponse>,
  deleteWorker: (name: string) => Promise<void>,
  wakeWorker: (name: string) => Promise<{name, phase}>,
  sleepWorker: (name: string) => Promise<{name, phase}>,
  ensureReadyWorker: (name: string) => Promise<{name, phase}>,
  getWorkerStatus: (name: string) => Promise<WorkerResponse>,

  // Teams / Humans / Managers（同形）
  // Gateway consumers
  // Packages (multipart upload)
  // Infrastructure
};
```

## 内部实现

### `proxyRequest(path, options?)`

```typescript
async function proxyRequest<T>(path: string, options: RequestInit = {}): Promise<T>
```

- 路径前缀：`/api/hiclaw`
- 自动注入 `Content-Type: application/json`（FormData 除外）
- 非 2xx → 抛 `ApiClientError.fromResponse(res, 'hiclaw', path)`
- 204 → 返回 `undefined as T`
- 非 JSON content-type → 抛 `INVALID_RESPONSE`
- JSON parse 失败 → 抛 `INVALID_RESPONSE`

### `healthRequest(controllerUrl)`

直连 `/api/hiclaw/healthz?controllerUrl=...`，返回 `text/plain 'ok'`。`checkConnection` 端点不是 JSON。

### `createTeam` 的兼容层

```typescript
createTeam: (data) => {
  const payload = { ...data };
  if (payload.admin && !payload.leader) {
    payload.leader = payload.admin;
    delete payload.admin;
  }
  return proxyRequest('/teams', { method: 'POST', body: JSON.stringify(payload) });
}
```

Controller 实际字段是 `leader.name`，旧 UI 用 `admin`。为兼容旧 dashboard 配置自动转换。

### 列表端点的双形兼容

`listWorkers` / `listTeams` / `listHumans` / `listManagers` / `listConsumers` 都同时接受两种响应：
- `WorkerResponse[]` 直接数组
- `{ workers: WorkerResponse[]; total?: number }` 对象

`proxyRequest<T>` 用 union 类型表达，返回时统一解为数组。

## 调用方

| Hooks | 文件 |
|---|---|
| Worker 列表/详情 | `src/hooks/use-hiclaw-workers.ts` / `use-hiclaw-worker-detail.ts` |
| Worker mutations | `src/hooks/use-hiclaw-mutations.ts:34-156` |
| Team 列表/详情 | `src/hooks/use-hiclaw-teams.ts` |
| Team mutations | `src/hooks/use-hiclaw-mutations.ts:165-227` |
| Human 列表 | `src/hooks/use-hiclaw-humans.ts` |
| Human mutations | `src/hooks/use-hiclaw-mutations.ts:236-290` |
| Manager 列表 | `src/hooks/use-hiclaw-managers.ts` |
| Manager mutations | `src/hooks/use-hiclaw-mutations.ts:299-339` |
| Consumer mutations | `src/hooks/use-hiclaw-mutations.ts:348-365` |
| Infrastructure | `src/hooks/use-hiclaw-infrastructure.ts` |

## 测试覆盖

`tests/hiclaw-api.test.ts` (10 用例)：
- 各资源 CRUD 成功路径
- 错误响应抛 `ApiClientError`（断言 `name` + `code`）
- 列表端点两种响应形
- `createTeam` admin → leader 转换
- `uploadPackage` multipart（FormData）
- `INVALID_RESPONSE` 当 content-type 非 JSON

## 不依赖

- 不依赖 React Query / SWR
- 不依赖 zustand
- 仅依赖 `./api-errors`

## 添加新资源

1. 加类型 + 加 `proxyRequest` 包装方法
2. 加代理路由 `src/app/api/hiclaw/<resource>/route.ts`
3. 加 hooks（如需要）
4. 加 audit action（如果是写操作）
5. 加测试

详见 [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md#添加新的-hiclaw-资源类型)。