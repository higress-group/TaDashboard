# src/lib/audit.ts

客户端审计写入器。所有破坏性 mutation 完成后调用 `recordAudit()`，由 `/api/audit` route 持久化到 SQLite。

## 公开 API

| 导出 | 描述 |
|---|---|
| `AuditAction` | 17 种 action 的 union |
| `AuditPayload` | `{action, resource, resourceId?, actor?, metadata?}` |
| `recordAudit(payload)` | 写入审计（fire-and-forget） |

## 行为约束

| 约束 | 实现 |
|---|---|
| SSR 安全 | `if (typeof window === 'undefined') return;` |
| 不阻塞主流程 | `keepalive: true` + 静默吞错 |
| 必填字段 | `action` / `resource`（服务端二次校验） |
| 可选字段 | `resourceId` / `actor` / `metadata` |

详见 [专有概念/recordAudit.md](../专有概念/recordAudit.md)。

## 调用清单

| Mutation | Action | metadata |
|---|---|---|
| `useCreateWorker` | `worker.create` | `{name, model, runtime}` |
| `useUpdateWorker` | `worker.update` | `{name, updatedFields}` |
| `useDeleteWorker` | `worker.delete` | `{name}` |
| `useWakeWorker` | `worker.wake` | `{name}` |
| `useSleepWorker` | `worker.sleep` | `{name}` |
| `useEnsureReadyWorker` | `worker.ensure-ready` | `{name}` |
| `useCreateTeam` | `team.create` | `{name, leader}` |
| `useUpdateTeam` | `team.update` | `{name, updatedFields}` |
| `useDeleteTeam` | `team.delete` | `{name}` |
| `useCreateHuman` | `human.create` | `{name, permissionLevel}` |
| `useUpdateHuman` | `human.update` | `{name, updatedFields}` |
| `useDeleteHuman` | `human.delete` | `{name}` |
| `useCreateManager` | `manager.create` | `{name, model}` |
| `useUpdateManager` | `manager.update` | `{name, updatedFields}` |
| `useDeleteManager` | `manager.delete` | `{name}` |
| `useCreateConsumer` | `consumer.create` | `{name}` |

## 使用示例

```typescript
import { recordAudit } from '@/lib/audit';

const useDeleteWorker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => hiclawApi.deleteWorker(name),
    onSuccess: (_, name) => {
      recordAudit({
        action: 'worker.delete',
        resource: 'worker',
        resourceId: name,
        metadata: { name },
      });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
  });
};
```

## 与服务端契约

`/api/audit` route 维护白名单 `ALLOWED_ACTIONS`，与客户端 `AuditAction` union **必须同步**。详见 [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md#添加新的审计-action)。

## 测试覆盖

`tests/audit.test.ts` (4 用例)：
- SSR 环境（无 window）→ 早返不发请求
- 客户端发送正确 POST body
- 可选字段缺失时正确处理
- 网络异常被静默吞掉

注意：测试需要 `vi.stubGlobal('window', {})` 模拟 window 环境（否则 recordAudit 早返）。

## 不做的事

- ❌ 不在服务端调用（防止把 server-side action 也计入审计）
- ❌ 不返回结果（fire-and-forget）
- ❌ 不重试（一旦失败就丢）
- ❌ 不加密 metadata（敏感字段不进 metadata）

## 依赖

- 仅依赖 `fetch` 全局
- 与服务端通过 `/api/audit` 端点通信（不需要直接 import server-side 函数）