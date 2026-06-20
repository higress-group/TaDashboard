# `src/app/api/activity/route.ts`

Activity Feed GET 端点。把 `AuditLog` 最新 20 条合并为统一格式，供顶栏 `<ActivityFeed />` 消费。

## 接口

```
GET /api/activity
Authorization: Bearer <AUDIT_WRITE_TOKEN>   # 可选，env 配置后强制
```

### Response 200

```json
{
  "items": [
    {
      "id": "ckxxxx",
      "kind": "audit",
      "ts": "2026-06-17T01:23:45.000Z",
      "actor": "alice",
      "action": "worker.create",
      "resource": "worker",
      "resourceId": "w-1",
      "preview": "launched worker for team-platform",
      "link": "#workers"
    }
  ]
}
```

### Response 401

`AUDIT_WRITE_TOKEN` 已配置但 Authorization header 不匹配或缺失。

## 关键设计

- **来源**：当前仅读 `auditLog` 表（首版）；未来扩展可合并 Matrix 消息 → `kind: 'matrix'` 或基础设施变更 → `kind: 'infrastructure'`。
- **20 条硬上限**：DB 查询 `take: 20` + 服务端 `slice(0, 20)` 双保险，避免后端忽略 `take` 时漏出去。
- **60 字符截断**：`metadata.preview` 截到 60 字符，末尾用 `…`。
- **链接推断**：`deriveLink` 把 resource 映射到 `#section` 锚点（`worker → #workers`、`team → #teams`、…）。
- **鉴权**：复用 audit 的 `AUDIT_WRITE_TOKEN` 约定；缺省时允许，配置后强制 Bearer。
- **错误格式**：`jsonErrorBody(code, message)` 与全站 API 错误信封一致。

## 消费方

- `src/components/dashboard/activity-feed.tsx`：TanStack Query 5 秒轮询（仅打开时），点击行 → 跳转 anchor。

## 契约测试

- `tests/activity-route.test.ts`（4 用例）：merged items sorted desc、20 cap、preview 截断、auth 401。

## 引用

- 设计：`specs/agent-chat-modernization/design.md` §"`src/app/api/activity/route.ts` (new)"
- 需求：R6-1 / R6-2 / R6-3
