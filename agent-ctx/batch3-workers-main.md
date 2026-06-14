# Task: batch3-workers - Workers Section UX Improvements

## Agent: main

## Summary
Completed all 6 requested improvements to the Workers Section:

1. **Table View Toggle** - Added Tabs/TabsList/TabsTrigger with card/table views. Table uses Table/TableHeader/TableRow/TableHead/TableBody/TableCell components with columns: select, name, phase, state, runtime, model, team, actions.

2. **Sort Controls** - Added Select dropdown with options: 按名称(default), 按阶段, 按运行时, 按团队.

3. **Pagination** - 12 items per page, with page number buttons (with ellipsis), prev/next buttons, and page indicator text.

4. **Removed YAML parser** - Replaced with JSON-only textarea. Dialog titled "JSON 配置应用" with hint "请输入 JSON 格式的 Worker 配置". Uses JSON.parse with toast.error on failure.

5. **Shared phase colors** - Now imports WORKER_PHASE_LABELS in addition to WORKER_PHASE_BADGE_CLASSES and RUNTIME_LABELS. Phase badges show Chinese labels. Detail dialog also uses shared labels.

6. **Auto-refresh** - Confirmed useWorkers hook already has refetchInterval: 15000.

## Files Modified
- `src/components/dashboard/sections/workers-section.tsx` - Major rewrite
- `/home/z/my-project/worklog.md` - Appended work log

## Verification
- ESLint: 0 errors, 0 warnings
- TypeScript: No new errors in our file
- Dev server: Lint clean, tsc clean for workers-section.tsx
