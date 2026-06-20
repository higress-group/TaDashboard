# src/lib/query-provider.tsx

React Query Provider 包装，配置全局默认选项。

## 职责

提供一个 React Query Client 给整个应用树，配合 hooks/use-hiclaw-* 使用。

## 配置

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,             // 10 秒
      retry: 1,                      // 失败重试 1 次
      refetchOnWindowFocus: false,   // 切回窗口不重取
    },
  },
})
```

| 选项 | 值 | 理由 |
|---|---|---|
| `staleTime` | 10000ms | 10 秒内复用缓存，避免频繁请求 |
| `retry` | 1 | 重试 1 次；太多次会让 UI 卡顿 |
| `refetchOnWindowFocus` | false | dashboard 通常连续查看，不必要重取 |

注意：当前**未**设置 mutation 的 `retry`，mutation 默认 0 次。

## 单例模式

```typescript
const [queryClient] = useState(() => new QueryClient({...}));
```

用 `useState` 懒初始化，避免每次 render 重新创建 client。React Strict Mode 双重 render 也只会创建一次。

## 挂载位置

`src/app/layout.tsx`：

```typescript
<QueryProvider>
  <ThemeProvider>
    {children}
  </ThemeProvider>
</QueryProvider>
```

`QueryProvider` 必须在 `use-hiclaw-*` hooks 调用的组件树之上。

## 依赖

- `@tanstack/react-query`

## hooks 用法

| Hook | 用途 |
|---|---|
| `useQuery({ queryKey: ['workers'], queryFn: () => hiclawApi.listWorkers() })` | 列表 |
| `useQuery({ queryKey: ['worker', name], queryFn: () => hiclawApi.getWorker(name), enabled: !!name })` | 详情 |
| `useMutation({ mutationFn: (data) => hiclawApi.createWorker(data) })` | 写 |

详见 `src/hooks/use-hiclaw-*.ts`。

## 修改注意

1. **`staleTime`** 提高会减少刷新频率，但用户看到的数据可能更旧
2. **`retry: 0`** 会让用户立即看到错误；`retry: 3` 会让 UI 卡顿。当前 1 次是折中
3. **`refetchOnWindowFocus: true`** 适合"用户跨 tab 切换"的场景，但 dashboard 主要在单一 tab

## 测试覆盖

`query-provider` 本身无需测试（薄包装）。hooks 测试通过 mock `hiclawApi` 间接覆盖 QueryClient 行为。

## 添加 Mutation 重试

```typescript
new QueryClient({
  defaultOptions: {
    queries: { /* ... */ },
    mutations: {
      retry: 1,  // 失败重试 1 次
    },
  },
})
```

注意：mutation 默认 `retry: 0`。某些场景（如"创建资源"）开了重试会导致重复创建。建议保持 0。