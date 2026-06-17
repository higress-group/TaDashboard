# `worker-bulk-action` 模块

> 文件位置：`src/hooks/use-worker-bulk-action.ts` · 组件：`src/components/dashboard/worker-bulk-action-bar.tsx`

按 phase / team 过滤后的 Worker 集合批量执行 6 种动作：sleep / wake / ensure-ready / 删除 / 导出 CSV / 导出 JSON。

## 6 个动作

| 动作 | API | 是否需确认 |
|---|---|---|
| wake | `POST /workers/{name}/wake` | AlertDialog 描述 |
| sleep | `POST /workers/{name}/sleep` | AlertDialog 描述 |
| ensure-ready | `POST /workers/{name}/ensure-ready` | AlertDialog 描述 |
| 删除 | `DELETE /workers/{name}` | AlertDialog 描述 + 输入 `DELETE` 字符 |
| 导出 CSV | 本地 `workersToCsv` | 无确认 |
| 导出 JSON | 本地 `workersToJson` | 无确认 |
| 复制 JSON | `copyToClipboard` | 无确认 |

## 串行执行

`runBulkAction(workers, op)` 是纯函数：

```typescript
export async function runBulkAction(
  workers: WorkerResponse[],
  op: BulkOp,
): Promise<{ successes: string[]; failures: BulkFailure[] }>
```

- 串行 `for` 循环
- 失败不中断 N+1
- `useWorkerBulkAction` 包装后：进度条 / 失败列表 / 重试 / 跳过 / cancel
- 完成时 `queryClient.invalidateQueries({ queryKey: ['workers'] })`

## 进度条

页面右下角 fixed `min(360px, 90vw)` 卡片：
- 进度条 `done / total` + 百分比
- 成功计数（绿） + 失败列表（红，每行可重试 / 跳过）
- 完成后 X 关闭 → `reset()`

## 测试

`tests/worker-bulk.test.ts`（6 用例）：串行 / 失败收集 / retry / skip / 全成功 / 空数组
