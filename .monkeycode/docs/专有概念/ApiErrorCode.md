# ApiErrorCode 与 ApiClientError

TaDashboard 用一套稳定的错误码统一前后端错误处理。本文档描述这套契约的来源、含义和使用方式。

## 错误码清单

| Code | HTTP | 含义 | 触发场景 |
|---|---|---|---|
| `BAD_REQUEST` | 400 | 客户端请求参数错误 | Controller 返回 400、客户端表单字段非法 |
| `UNAUTHORIZED` | 401 | 未授权 | 缺失/失效的 Bearer Token、SA token |
| `FORBIDDEN` | 403 | 权限不足 | RBAC 拒绝 |
| `NOT_FOUND` | 404 | 资源不存在 | GET `/workers/{name}` 但 name 不存在 |
| `CONFLICT` | 409 | 状态冲突 | 重复创建同名资源、删除正在运行的资源 |
| `RATE_LIMITED` | 429 | 限流 | Controller 触发限流 |
| `UPSTREAM_TIMEOUT` | 504 | 上游超时 | fetch /api/hiclaw/* 超时（30s 默认） |
| `UPSTREAM_UNAVAILABLE` | 502/503/504 | 上游不可达 | Controller / Matrix 离线、connect refused |
| `UPSTREAM_ERROR` | 502 | 上游内部错误 | 其他 5xx |
| `INVALID_RESPONSE` | 502 | 响应格式异常 | 上游返回非 JSON |
| `CONFIGURATION_ERROR` | 500 | 配置错误 | 服务端 .env 缺失关键值 |
| `INTERNAL_ERROR` | 500 | 内部错误 | 兜底 |

## HTTP → Code 映射

`statusToCode()` (`src/lib/api-errors.ts:34-44`) 把上游 HTTP 状态码翻译成 ApiErrorCode：

| HTTP 状态 | ApiErrorCode |
|---|---|
| 400 | BAD_REQUEST |
| 401 | UNAUTHORIZED |
| 403 | FORBIDDEN |
| 404 | NOT_FOUND |
| 409 | CONFLICT |
| 429 | RATE_LIMITED |
| 502 / 503 / 504 | UPSTREAM_UNAVAILABLE |
| 其他 5xx | UPSTREAM_ERROR |
| 其他 | INTERNAL_ERROR |

## 错误信封（API 响应体）

所有错误响应都遵循同一形状 (`src/lib/api-errors.ts:21-32`)：

```typescript
interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    upstream?: {
      status?: number;          // 上游原始 HTTP 状态
      service: 'hiclaw' | 'matrix';
      path?: string;             // 上游路径（与客户端发起的不同）
    };
  };
}
```

示例：
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "User lacks permission to delete this worker",
    "upstream": {
      "status": 403,
      "service": "hiclaw",
      "path": "/workers/foo"
    }
  }
}
```

## 客户端错误类型

`ApiClientError` (`src/lib/api-errors.ts:128-175`) 是浏览器侧统一的错误类，所有 fetch 失败都包装为该类。

```typescript
class ApiClientError extends Error {
  code: ApiErrorCode;
  status?: number;
  service: 'hiclaw' | 'matrix' | 'client';
  path?: string;
  details?: unknown;
}
```

### 构造方法

| 方法 | 何时用 |
|---|---|
| `new ApiClientError(code, msg, init)` | 主动抛错（如 `INVALID_RESPONSE`） |
| `await ApiClientError.fromResponse(res, service, path)` | 解析 fetch 失败响应（自动解析信封 + 降级 fallback） |

### fromResponse 的降级行为

`fromResponse` (`src/lib/api-errors.ts:145-174`) 按以下优先级构造错误：

1. 如果响应是合法 `ApiErrorBody` → 使用信封里的 code/message/details
2. 否则用响应文本作为 message + 用 `statusToCode(res.status)` 推断 code
3. 完全解析失败 → `INTERNAL_ERROR` + `res.statusText`

## UI 翻译

`describeApiError(code)` (`src/lib/api-errors.ts:187-263`) 把 code 翻译成 {title, description, actionable} 三元组，前端 toast/横幅用：

```typescript
interface ErrorHint {
  title: string;          // 中文短标题
  description: string;    // 详细描述
  actionable: boolean;    // 是否提示用户可以采取行动
}
```

| Code | Title |
|---|---|
| UNAUTHORIZED | 未授权 |
| FORBIDDEN | 权限不足 |
| NOT_FOUND | 资源不存在 |
| CONFLICT | 操作冲突 |
| RATE_LIMITED | 请求过于频繁 |
| UPSTREAM_TIMEOUT | 上游超时 |
| UPSTREAM_UNAVAILABLE | 上游不可达 |
| UPSTREAM_ERROR | 上游错误 |
| INVALID_RESPONSE | 响应格式异常 |
| CONFIGURATION_ERROR | 配置错误 |
| BAD_REQUEST | 请求参数错误 |
| INTERNAL_ERROR | 内部错误 |

`actionable=true` 表示 UI 应提供按钮（如"打开设置"、"检查 ServiceAccount"）。

## 添加新错误码

修改 `src/lib/api-errors.ts` 三处：

1. union 加新 code
2. `statusToCode()` 加映射（如适用）
3. `describeApiError()` 加分支

详见 [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md#添加新的-apierrorcode)。