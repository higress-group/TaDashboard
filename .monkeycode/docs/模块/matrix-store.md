# src/lib/matrix-store.ts

Matrix 登录状态 + token 持久化的 zustand store。客户端全局唯一。

## 职责

1. 保存登录后的 accessToken / userId / deviceId
2. 跟踪登录状态（isLoggedIn / isLoggingIn / loginError）
3. 跟踪同步状态（syncToken / isSyncing）
4. 提供 `login()` / `logout()` action
5. 配置 token 持久化策略（session / local / none）

## State

```typescript
interface MatrixState {
  homeserver: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  isLoggedIn: boolean;
  isLoggingIn: boolean;
  loginError: string | null;

  syncToken: string | null;
  isSyncing: boolean;

  login: (homeserver: string, username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setHomeserver: (url: string) => void;
  setSyncToken: (token: string | null) => void;
  setSyncing: (syncing: boolean) => void;
}
```

## Token 持久化策略

详见 [专有概念/Token-持久化策略.md](../专有概念/Token-持久化策略.md)。

```typescript
type MatrixTokenPersist = 'session' | 'local' | 'none';
const persistMode = resolvePersistMode();  // 从 NEXT_PUBLIC_MATRIX_TOKEN_PERSIST 读
```

`createMatrixStorage(persistMode)` (`matrix-store.ts:17-37`) 返回适配 zustand persist 的 storage shim：
- `session` → sessionStorage
- `local` → localStorage
- `none` → noop（getItem 永远 null）

SSR 环境（无 window）→ 自动降级 noop，客户端 hydrate 时正常。

## partialize

```typescript
partialize: (state) => ({
  homeserver: state.homeserver,
  accessToken: state.accessToken,
  userId: state.userId,
  deviceId: state.deviceId,
  isLoggedIn: state.isLoggedIn,
  syncToken: state.syncToken,
})
```

**不**持久化：`loginError` / `isLoggingIn` / `isSyncing`（瞬时态）。

store key: `'matrix-store'`
version: `2`（破坏式升级时 bump）

## login 流程

```typescript
login: async (homeserver, username, password) => {
  set({ isLoggingIn: true, loginError: null });
  try {
    const result = await matrixApi.login(homeserver, username, password);
    set({
      homeserver,
      accessToken: result.access_token,
      userId: result.user_id,
      deviceId: result.device_id,
      isLoggedIn: true,
      isLoggingIn: false,
      loginError: null,
      syncToken: null,  // 新会话重置同步游标
    });
    return true;
  } catch (err) {
    set({ isLoggingIn: false, loginError: message, isLoggedIn: false });
    return false;
  }
}
```

注意 `syncToken: null` 重置 — 避免新登录携带旧会话的 since token。

## logout

`logout()` 清空 `accessToken` / `userId` / `deviceId` / `syncToken` / `isSyncing`，但**不清空** `homeserver`（方便重新登录同一 homeserver）。

不调 `/api/matrix/logout` — Matrix 协议允许客户端直接丢弃 token。

## 测试覆盖

`tests/matrix-store.test.ts` (7 用例)：
- session 模式写入 sessionStorage
- local 模式写入 localStorage
- none 模式不写任何 storage
- SSR 环境降级为 noop
- `__testing_createMatrixStorage` 注入 helper 用于测试

## 调用方

| 组件 | 用途 |
|---|---|
| `matrix-login.tsx` | 调用 `login()`，读 `loginError` |
| `chat-section.tsx` | 读 `accessToken` / `userId` / `homeserver` 调 matrixApi |
| `use-matrix.ts` | sync 循环管理 `syncToken` / `isSyncing` |

## 依赖

- `zustand`
- `zustand/middleware` 的 `persist` + `createJSONStorage`
- `./matrix-api`（用于 `login()`）

## 导出

```typescript
export const useMatrixStore: UseBoundStore<StoreApi<MatrixState>>
export const MATRIX_TOKEN_PERSIST_MODE: MatrixTokenPersist  // 当前实际模式
export function __testing_createMatrixStorage(persistMode): Storage
```

`__testing_createMatrixStorage` 是测试专用导出，命名 `__testing_` 前缀显式标记内部 API。