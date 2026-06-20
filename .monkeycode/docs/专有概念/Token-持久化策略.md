# Matrix Token 持久化策略

Matrix 的 accessToken 是高敏感凭据，TaDashboard 提供三种持久化策略，让操作员根据部署场景选择合适的取舍。

## 三种模式

| 模式 | 存储 | 适用场景 | 风险 |
|---|---|---|---|
| `none` (默认) | 不持久化 | 公共终端 / 高安全场景 | 低：每次刷新需重新登录 |
| `session` | sessionStorage | 单浏览器会话，关闭即清 | 中：xss 可偷单次会话 |
| `local` | localStorage | 跨会话保留（kiosk 模式） | 高：xss 可永久偷 token |

> 默认改为 `none`：原 `session` 默认值带来 XSS 窃取 risk，且代码注释只承诺"关闭即清"，实际场景未必立即关闭浏览器。`none` 强制每次刷新重新登录 — 高安全场景最安全，开发者日常部署只需设一次 `NEXT_PUBLIC_MATRIX_TOKEN_PERSIST=session`。

## 配置

环境变量 `NEXT_PUBLIC_MATRIX_TOKEN_PERSIST`：

```bash
# .env.local
NEXT_PUBLIC_MATRIX_TOKEN_PERSIST=session   # 默认
NEXT_PUBLIC_MATRIX_TOKEN_PERSIST=local
NEXT_PUBLIC_MATRIX_TOKEN_PERSIST=none
```

大小写不敏感（`matrix-store.ts:11`）。非法值降级为 `session`。

由于是 `NEXT_PUBLIC_*`，运行时打包到客户端 bundle — 不要试图通过加密方式保护（key 在 bundle 里）。

## 实现

`createMatrixStorage(persistMode)` (`matrix-store.ts:17-37`)：

```typescript
function createMatrixStorage(persistMode: MatrixTokenPersist) {
  if (persistMode === 'none') {
    return createJSONStorage(() => noopStorage);  // getItem -> null
  }
  const backend = persistMode === 'session' ? 'sessionStorage' : 'localStorage';
  return createJSONStorage(() => {
    if (typeof window === 'undefined') {
      return noopStorage;  // SSR safe fallback
    }
    return window[backend];
  });
}
```

`persist` 配置 (`matrix-store.ts:122-134`)：
- `name: 'matrix-store'` — localStorage key
- `partialize: state => ({ homeserver, accessToken, userId, deviceId, isLoggedIn, syncToken })` — **不**持久化 `loginError` / `isLoggingIn` / `isSyncing` 等瞬时态
- `version: 2` — Zustand persist 版本号，破坏式变更时升级

## 选择指南

| 场景 | 推荐 |
|---|---|
| 个人开发者笔记本 | `session` 或 `local` |
| 共享办公电脑 | `none`（每次登录） |
| k3s kiosk 部署（专用平板） | `local`（操作员只需登录一次） |
| 公共信息屏 | `none` |
| 安全合规要求"不持久化凭据" | `none` |

## 安全考量

1. **永远不要** 把 accessToken 写到 `.env` — 应该由用户登录生成
2. **永远不要** 把 accessToken 加进 SSR cookie — 浏览器 <-> Server 之间走 matrix proxy (`/api/matrix/*`) 即可
3. localStorage 是同源可读 — 任何 XSS 漏洞都能偷走 token。最小化 XSS 面（避免 `dangerouslySetInnerHTML` / 不引入未审查 npm 包）
4. `none` 模式下，每次刷新都要重新登录。建议只在"操作员在场"场景用

## Token 过期自动登出

`src/lib/matrix-store.ts` 加了**两层过期检测**：

1. **本地过期（默认 8 小时）**：登录时记 `tokenIssuedAt`，下次读取时若 `Date.now() - tokenIssuedAt > NEXT_PUBLIC_MATRIX_TOKEN_MAX_AGE_MS`，自动 `logout()`
2. **服务端失效**：每次 rehydrate（页面刷新）后 `validateStoredToken()` 用 `getJoinedRooms` 探活：
   - 401/403 → 立即 `logout()`
   - 网络错/超时 → 不动（避免误登出）

通过 env 调：
```bash
NEXT_PUBLIC_MATRIX_TOKEN_MAX_AGE_MS=28800000  # 8h
```

store `version` 从 2 升到 3 — 旧 storage 自动丢弃（schema 加了 `tokenIssuedAt` 字段）。

## 安全考量（更新）

5. **服务端失效不等同于 token 失效** — 探活只能问 Matrix，不能预知其他被吊销的场景。XSS 仍然能读到 storage 中的 token；只要持久化开启，就接受这个 trade-off。

## 测试覆盖

`tests/matrix-store.test.ts` (7 用例) 覆盖：
- `session` 模式写入 `sessionStorage`
- `local` 模式写入 `localStorage`
- `none` 模式不写入任何 storage
- SSR 环境（无 window）降级为 noop

测试通过 `__testing_createMatrixStorage` (`matrix-store.ts:39-41`) 显式注入 storage 后端，验证各模式的 `getItem` / `setItem` 行为。

## 调试

```typescript
// 在浏览器 console 查看当前持久化模式
__NEXT_DATA__.props.pageProps // 看不到，bundle 时已确定
// 正确做法：看 network 请求中 Next.js 注入的 env
```

或临时在 `matrix-store.ts:11` 加 `console.log(resolvePersistMode())` 调试。

## 未来扩展

如果要加 `encrypted-local` 模式（用 crypto.subtle + 派生密钥），需要：
1. 引入用户输入的 passphrase（每次启动需输入）
2. 权衡是否值得（passphrase 本身也要存某处）

当前不实现，因为 passphrase 存储点本身又会变成 XSS 目标。