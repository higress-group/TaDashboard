# prisma/schema.prisma 与 src/lib/db.ts

本地 SQLite 数据库 schema + Prisma Client 单例。

## 设计原则

> The local database only holds dashboard-side state (notifications, audit trails, UI preferences, connection attempts). Authoritative resource state (Workers / Teams / Humans / Managers / etc.) is owned by the HiClaw Controller.

Dashboard 数据库**只**存"dashboard 自己关心的状态"。真正的资源权威是 Controller。

## 数据模型

### Notification

| 字段 | 类型 | 描述 |
|---|---|---|
| `id` | String (cuid) | 主键 |
| `type` | String | 'info' / 'warning' / 'error' |
| `title` | String | 短标题 |
| `message` | String | 详细描述 |
| `read` | Boolean (default false) | 是否已读 |
| `createdAt` | DateTime (default now) | 创建时间 |

索引：`[createdAt]`

用途：跨页面刷新保留通知（如 controller 离线警告、worker 启动失败提示等）。

### ConnectionAttempt

| 字段 | 类型 | 描述 |
|---|---|---|
| `id` | String (cuid) | 主键 |
| `url` | String | 探活的 controller URL |
| `success` | Boolean | 是否成功 |
| `latency` | Int? | 响应延迟（ms） |
| `error` | String? | 错误信息 |
| `createdAt` | DateTime | 探活时间 |

索引：`[createdAt]`

> 注：`hiclaw-store.connectionHistory` 用 zustand persist（localStorage，5 条上限），这是 in-memory 副本。如需长期历史，应落库。当前**未**实现 zustand → DB 同步。

### UserPreference

| 字段 | 类型 | 描述 |
|---|---|---|
| `key` | String | 主键（如 `dashboard.theme`） |
| `value` | String | 值（JSON 字符串） |
| `updatedAt` | DateTime @updatedAt | 最后修改 |

无索引（key 已是主键）。

用途：跨会话持久化用户偏好。当前 UI 主要用 zustand persist，UserPreference 表**未**广泛使用。

### AuditLog

| 字段 | 类型 | 描述 |
|---|---|---|
| `id` | String (cuid) | 主键 |
| `action` | String | 'worker.create' / 'team.delete' 等 |
| `resource` | String | 'worker' / 'team' / 'human' |
| `resourceId` | String? | 资源名（worker.name 等） |
| `actor` | String? | 行为发起者 |
| `metadata` | String? | JSON 字符串 |
| `createdAt` | DateTime | 操作时间 |

索引：`[createdAt]` 和 `[resource, resourceId]`

详见 [专有概念/recordAudit.md](../专有概念/recordAudit.md)。

## Prisma Client 单例

`src/lib/db.ts`：

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

**为什么需要 globalThis 模式**：Next.js dev mode 下，HMR 会反复创建 PrismaClient 实例，导致连接耗尽。挂到 `globalThis` 上复用同一实例。

## 配置

```bash
# .env.local
DATABASE_URL=file:./db/custom.db
```

SQLite 文件路径默认在 `./db/custom.db`，由 prisma migrate / push 自动创建。

## 命令

```bash
npm run db:push       # db push 到 SQLite（开发用，破坏式）
npm run db:migrate    # 创建并应用迁移（生产用）
npm run db:generate   # 重新生成 Prisma Client
npm run db:studio     # 打开 Prisma Studio
```

## 添加新表

1. 在 `prisma/schema.prisma` 加 model
2. `npm run db:push`（dev）或 `npm run db:migrate -- --name <name>`
3. 在 `src/lib/db.ts` 之外直接 `import { db } from '@/lib/db'` 用

## 已知约束

- SQLite 不支持并发写 → audit log 频繁写入有概率锁。Dashboard 单用户场景足够
- 无 ROW LEVEL SECURITY → SQLite 文件本身要保护（部署用 k8s secrets + PVC）
- 不备份策略 → 用户自行加 cron / k8s CronJob 备份 `.db` 文件

## 迁移历史

暂无正式迁移文件（仓库用 `db:push`）。生产部署建议改用 `db:migrate`。

## 测试覆盖

当前**未**为 Prisma 模型写测试。`/api/audit` route 的测试通过 mock 间接覆盖 AuditLog 行为。

## 依赖

- `@prisma/client`
- `prisma`（devDep）