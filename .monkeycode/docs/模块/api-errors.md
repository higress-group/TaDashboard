# src/lib/api-errors.ts

共享错误码目录 + 服务端/客户端双侧的错误构造工具。

## 职责

1. 定义 12 种稳定的 `ApiErrorCode`（前后端共用）
2. 提供 HTTP 状态 ↔ ApiErrorCode 的双向映射
3. 提供服务端构造 JSON 错误响应的工具（`jsonError` / `jsonErrorResponse`）
4. 提供客户端 `ApiClientError` 类（含 `fromResponse` 解析）
5. 提供 UI 翻译函数 `describeApiError(code) → ErrorHint`

## 公开 API

### 类型

| 导出 | 描述 |
|---|---|
| `ApiErrorCode` | 12 种错误码 union |
| `ApiErrorBody` | 服务端 JSON 错误体形状 |
| `ApiClientErrorInit` | 构造 ApiClientError 的初始化参数 |
| `ErrorHint` | `{title, description, actionable}` |

### 服务端函数

| 函数 | 用途 |
|---|---|
| `statusToCode(status: number)` | HTTP → ApiErrorCode |
| `jsonErrorBody(code, message, init?)` | 构造 `ApiErrorBody` |
| `jsonErrorResponse(code, message, init?)` | 构造 `Response` 对象 |
| `jsonError` (alias) | `jsonErrorBody` 别名 |
| `isApiErrorBody(value)` | 类型守卫 |
| `describeApiError` / `describeErrorCode` | UI 翻译 |
| `statusToCodeToStatus` (内部) | ApiErrorCode → HTTP（默认 status） |

### 客户端类

| 方法 | 用途 |
|---|---|
| `new ApiClientError(code, message, init)` | 主动抛错 |
| `ApiClientError.fromResponse(res, service, path)` | 解析 fetch 失败响应 |

## 使用示例

### 服务端（Next.js route handler）

```typescript
import { jsonErrorResponse } from '@/lib/api-errors';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return jsonErrorResponse('BAD_REQUEST', 'Body must be JSON');
  }
  const res = await fetch(controllerUrl, { /* ... */ });
  if (!res.ok) {
    return jsonErrorResponse('UPSTREAM_UNAVAILABLE', `Controller returned ${res.status}`, {
      upstream: { status: res.status, service: 'hiclaw', path: '/workers' },
    });
  }
  return NextResponse.json(await res.json());
}
```

### 客户端（hooks）

```typescript
import { hiclawApi } from '@/lib/hiclaw-api';

const onClick = async () => {
  try {
    await hiclawApi.createWorker({ name: 'foo', runtime: 'openclaw' });
    toast.success('创建成功');
  } catch (err) {
    if (err instanceof ApiClientError) {
      const { title, description, actionable } = describeApiError(err.code);
      toast.error(`${title}: ${description}`);
    }
  }
};
```

## 错误码详解

详见 [专有概念/ApiErrorCode.md](../专有概念/ApiErrorCode.md)。

## 关键约束

1. **服务端只构造，不解析** — `jsonErrorBody`/`jsonErrorResponse` 只造信封；解析在客户端 `fromResponse` 中
2. **ApiClientError 不依赖 React** — 纯 TS，可在任何环境（worker / node script / browser）使用
3. **`fromResponse` 用 `res.clone()`** — 不消耗原始 Response body
4. **status 降级** — 上游 502/503/504 都映射到 `UPSTREAM_UNAVAILABLE`，因为前端的处理逻辑相同（提示用户"稍后重试"）

## 测试覆盖

`tests/api-errors.test.ts` (10 用例)：
- 12 种 ApiErrorCode 都被 `describeApiError` 覆盖
- `statusToCode` 各种边界（400/401/403/404/409/429/500/502/503/504/其他）
- `jsonErrorBody` 序列化正确
- `ApiClientError.fromResponse` 三种 payload（合法信封 / 字符串 / null）
- `ErrorHint.actionable` 字段语义正确

## 依赖

| 导入 | 用途 |
|---|---|
| （无外部依赖） | 完全基于 fetch 标准库 |
| `./audit` （无） | 不依赖 |

## 修改时必读

任何修改必须同步更新 [INTERFACES.md](../INTERFACES.md) 的"错误信封契约"章节。