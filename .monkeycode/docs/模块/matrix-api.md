# src/lib/matrix-api.ts

Matrix Client-Server API 客户端。所有请求通过 Next.js 代理路由 `/api/matrix/*`，与 homeserver 通信。

## 公开 API

### 类型

| 类型 | 描述 |
|---|---|
| `MatrixLoginResponse` | login 返回值 |
| `MatrixEvent` | 单条 Matrix 事件（消息、state 等） |
| `MatrixJoinedRoom` | sync 返回的房间视图 |
| `MatrixSyncResponse` | /sync 响应 |
| `MatrixMessagesResponse` | 房间消息分页 |
| `MatrixMembersResponse` | 房间成员 |
| `MatrixJoinedRoomsResponse` | 用户加入的房间列表 |
| `MatrixRoomStateEvent` | state 事件 |

### API 客户端对象

```typescript
export const matrixApi = {
  login: (homeserver, username, password) => Promise<MatrixLoginResponse>,
  sync: (homeserver, accessToken, since?, timeout?) => Promise<MatrixSyncResponse>,
  getJoinedRooms: (homeserver, accessToken) => Promise<MatrixJoinedRoomsResponse>,
  getRoomMessages: (homeserver, accessToken, roomId, options?) => Promise<MatrixMessagesResponse>,
  getRoomMembers: (homeserver, accessToken, roomId) => Promise<MatrixMembersResponse>,
  getRoomState: (homeserver, accessToken, roomId) => Promise<MatrixRoomStateEvent[]>,
  sendMessage: (homeserver, accessToken, roomId, body, options?) => Promise<{event_id}>,
};
```

## 设计要点

### 1. accessToken 通过 query 参数传递

每个请求的 URL 都带 `?homeserver=...&accessToken=...`。这是因为：
- Server-side 代理需要同时知道 homeserver 和 token（不能只看 referer）
- Matrix 协议允许 query 参数传 access_token
- 避免把 token 放 header（某些代理实现不希望改 header）

注意：query 参数会进入 server log — 确保 server-side 不要把 full URL 打 log。

### 2. 错误统一抛 ApiClientError

所有方法 `if (!res.ok) throw await ApiClientError.fromResponse(res, 'matrix', path)`。

错误信封由 `/api/matrix/*` 代理路由构造，详见 [INTERFACES.md](../INTERFACES.md)。

### 3. 没有持久化

matrix-api 是纯函数式客户端，不读 store。Token / homeserver 由调用方从 `useMatrixStore` 取出后传入。

### 4. roomId URL 编码

`encodeURIComponent(roomId)` —— Matrix roomId 形如 `!abc:homeserver`，`!` 是合法字符但 URL 里有特殊语义。

## 调用方

| Hook | 文件 |
|---|---|
| `useMatrix` / `useMatrixChat` | `src/hooks/use-matrix.ts` |
| `login` | `src/components/matrix-login.tsx` |
| `chat-section` | `src/components/dashboard/sections/chat-section.tsx` |

## 代理路由

每个客户端方法对应一个 Next.js 路由：

| 客户端方法 | 路由 |
|---|---|
| `login` | `POST /api/matrix/login` |
| `sync` | `GET /api/matrix/sync` |
| `getJoinedRooms` | `GET /api/matrix/joined-rooms` |
| `getRoomMessages` | `GET /api/matrix/rooms/[roomId]/messages` |
| `getRoomMembers` | `GET /api/matrix/rooms/[roomId]/members` |
| `getRoomState` | `GET /api/matrix/rooms/[roomId]/state` |
| `sendMessage` | `PUT /api/matrix/rooms/[roomId]/send` |

## 测试覆盖

- `tests/matrix-proxy-helper.test.ts` (7) — 测 homeserver allow-list
- `tests/matrix-store.test.ts` (7) — 测 token 持久化策略

matrix-api.ts 本身暂未单测（属于薄包装）。

## 依赖

- 仅依赖 `./api-errors`
- 不依赖 React / zustand

## 安全注意

1. accessToken 是高敏感凭据 — 见 [专有概念/Token-持久化策略.md](../专有概念/Token-持久化策略.md)
2. 不要让 accessToken 出现在 client log（用 `console.debug` 而非 `console.log`）
3. proxy 路由要做 homeserver allow-list，防止 SSRF（见 [INTERFACES.md](../INTERFACES.md)）