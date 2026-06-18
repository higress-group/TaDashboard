# 共享 React Query 配置 + 副作用 Hook (query-config / use-reset-flag)

涵盖 v2 重构抽出的两个新模块：`DEFAULT_QUERY_CONFIG` 共享 React Query defaults，
`useResetFlag` 替换 5 处 setTimeout-reset 模式。

## 文件
| 文件 | 职责 |
|---|---|
| `src/lib/query-config.ts` | React Query 全局默认配置（staleTime/retry/refetch/throwOnError） |
| `src/hooks/use-reset-flag.ts` | 通用 transient 布尔状态（典型场景：copy 提示），timer 受 ref 保护 |

---

## DEFAULT_QUERY_CONFIG

`src/lib/query-config.ts:1-12`

### 统一默认值

```ts
export const DEFAULT_QUERY_CONFIG = {
  staleTime: 10_000,             // 10s 内不重发请求
  retry: 1,                       // 失败重试 1 次
  refetchOnWindowFocus: false,   // tab 切回不重发
  refetchIntervalInBackground: false,  // 后台不轮询
  throwOnError: false,           // 错误不抛到 React 错误边界
} as const;
```

### 使用

每个 `useQuery` 调用点用 `...DEFAULT_QUERY_CONFIG` 注入：

```ts
return useQuery<ManagerResponse[]>({
  queryKey: ['hiclaw-managers'],
  queryFn: () => hiclawApi.listManagers(),
  refetchInterval: 15000,          // 个性：15s 轮询
  ...DEFAULT_QUERY_CONFIG,         // 共享：5 个默认值
  placeholderData: (previousData) => previousData,
});
```

`QueryProvider` 也用同样默认值初始化：

```ts
new QueryClient({
  defaultOptions: { queries: { ...DEFAULT_QUERY_CONFIG } },
})
```

### 收益
- 12 个 hooks 收敛 ~80 行重复配置
- 所有轮询 query 行为一致：tab 切回 / 后台不重发
- 改一个值影响全部 hooks，不用逐文件替换

### 跳过例外
- `useMatrix` / `useMatrixRoomMessages`：ephemeral 轮询（typing 事件 / Matrix sync），用 `staleTime: 5000` 满足更快的事件流
- `useHiclawMutations`：是 `useMutation` 不是 `useQuery`，不适用

---

## useResetFlag

`src/hooks/use-reset-flag.ts:1-42`

### 替代反模式

旧模式：5 个 CopyButton 各自有

```tsx
const [copied, setCopied] = useState(false);
const handleCopy = () => {
  navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);  // 卸载后调用 → React warning
};
```

新模式：

```tsx
const [copied, setCopied] = useResetFlag(2000);
const handleCopy = () => {
  navigator.clipboard.writeText(text);
  setCopied();
};
```

### 行为契约

1. **timer 唯一**：内部 `useRef<setTimeout>`，每次 `set()` 取消上一个 timer
2. **卸载安全**：`useEffect(() => clear, [])` 在 unmount 清掉 pending timer
3. **manual reset**：`reset()` 不等待立即清零 + 取消 timer
4. **set(false)**：直接清零，不调度 timer
5. **返回 3 元组**：`[value, set, reset]`

### 测试覆盖

`tests/use-reset-flag.test.ts:1-69`（6 用例 jsdom env）：

- 初始 false
- `set()` → Nms 后自动回 false
- 重复 set 重置 timer（之前的延后）
- `reset()` 立即清零
- `set(false)` 不调度 timer
- unmount 清理

### 使用约定

任何 "成功 → 显示确认 N 毫秒 → 自动消失" 的 UI 提示都应用 `useResetFlag`：
- Copy 按钮
- Save 成功 toast
- Action 触发后的"已提交"反馈

## 关联文档
- `ui-shell.md`：SurfaceShell / format / useShallow 选择器
- `worker-metrics.md`：worker 资源指标获取
- `phase-timeline.md`：events 流抽取 phase 时间线
