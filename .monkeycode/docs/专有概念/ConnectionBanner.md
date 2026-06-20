# ConnectionBanner 错误降级

ConnectionBanner 是 Dashboard 顶部的连接状态横幅，根据错误码切图标/文案并提示可执行动作。

## 显示条件

```typescript
if (isConnected) return null;
```

只显示在"未连接"状态，连接成功后立即消失。

## 三种状态

| 状态 | 触发 | 渲染 |
|---|---|---|
| 已连接 | `isConnected=true` | 不渲染 |
| 连接中 | `isChecking=true` | Clock/Loder2 + 重试按钮禁用 |
| 失败 | `isConnected=false && !isChecking` | WifiOff/ShieldAlert + 重试/设置按钮 + 倒计时 |

## 错误码分支

`connectionError.code` 是 `ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN'`，其中：
- 真正的 ApiErrorCode 走 `describeApiError()` 翻译
- `NETWORK_ERROR`（fetch 抛异常，如 ECONNREFUSED）→ 不传 `errorCode`，仅显示原始 message
- `UNKNOWN`（fallback）→ 同上

```typescript
const errorCode =
  connectionError && connectionError.code !== 'NETWORK_ERROR' && connectionError.code !== 'UNKNOWN'
    ? connectionError.code
    : undefined;
const hint = errorCode ? describeApiError(errorCode) : null;
const isAuthError = errorCode === 'UNAUTHORIZED' || errorCode === 'FORBIDDEN';
const Icon = isAuthError ? ShieldAlert : WifiOff;
```

### 图标选择

| 错误码 | 图标 | 文案 |
|---|---|---|
| UNAUTHORIZED / FORBIDDEN | `ShieldAlert` | "HiClaw Controller 鉴权失败" |
| 其他 / NETWORK_ERROR / UNKNOWN | `WifiOff` | "未连接到 HiClaw Controller" |

## 显示元素

| 元素 | 内容 |
|---|---|
| 图标 | `ShieldAlert` 或 `WifiOff` |
| 主文案 | 标题（如"HiClaw Controller 鉴权失败"） |
| 副标题 | `(controllerUrl)` |
| 错误 message | `connectionError.message` |
| 详细 hint | `describeApiError(code).description`（仅 md+ 屏幕） |
| 倒计时 | 下次自动重试的秒数（autoReconnect=true 且 countdown>0） |
| 重试按钮 | 触发 `checkConnection()` |
| 设置按钮 | 打开 settings dialog |

## 自动重连倒计时

`ConnectionBanner` 用 `setInterval(...,1000)` 每秒 tick 一次算 elapsed，配合 `reconnectInterval` 算剩余秒数。`hi-claw-dashboard.tsx` 启动时调用 `useHiClawStore.getState().checkConnection()` 做首次探活。

## 与 HiClawStore 的耦合

| 字段 | 来源 |
|---|---|
| `isConnected` | store 状态 |
| `isChecking` | store 状态 |
| `connectionError` | store 状态（`{code, message} \| null`） |
| `controllerUrl` | store 持久化（localStorage） |
| `autoReconnect` | store 持久化 |
| `reconnectInterval` | store 持久化 |
| `checkConnection` | store action |
| `openSettings` | store action（触发 settings dialog） |

## `connectionError` 形状契约

`hiclaw-store.ts:13-16` 定义：

```typescript
interface ConnectionErrorInfo {
  code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
}
```

`code` 字段由 `readErrorInfo()` (`hiclaw-store.ts:41-61`) 解析：
- 响应体是合法 `ApiErrorBody` → 用信封里的 `code` 与 `message`
- 解析失败 / 响应非对象 / code 不是字符串 → `{ code: 'UNKNOWN', message: fallback }`

`checkConnection` catch 块（fetch 抛异常）→ `{ code: 'NETWORK_ERROR', message: err.message }`。

## 视觉规范

- 背景：`bg-amber-500/10`（amber 半透明）
- 边框：`border-b border-amber-500/20`
- 文本色：`text-amber-600 dark:text-amber-400`
- 按钮：`h-7 text-xs`（紧凑型）

不允许用红色（红=严重错误；连接失败是预期状态，amber 警告色更准确）。

## 相关文件

- `src/components/dashboard/connection-banner.tsx` — 组件主体
- `src/components/dashboard/settings-dialog.tsx` — 用户修改 `controllerUrl` / `autoReconnect`
- `src/lib/hiclaw-store.ts` — 状态管理 + 自动重连定时器
- `src/lib/api-errors.ts` — `describeApiError()` 错误码翻译