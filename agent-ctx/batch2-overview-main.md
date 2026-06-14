# Task: batch2-overview - Redesign Overview Section

## Summary
Redesigned the Overview section from a static marketing landing page into a real-time monitoring dashboard inspired by Hermes.

## Changes Made

### Rewritten: `src/components/dashboard/sections/overview-section.tsx`
- **Removed**: `featureCards` array (6 static marketing feature cards)
- **Removed**: "最新动态" static news section
- **Fixed**: Misleading "技能总数" stat → replaced with "Managers" (online/offline split); skills count shown as badge on "查看技能" button
- **New Layout**:
  - Row 1: Compact Status Bar (connection badge, version, K8s mode, auto-refresh countdown)
  - Row 2: 4 Key Metrics (Active Workers w/ phase mini-bar, Active Teams w/ readiness %, Matrix Rooms, Managers w/ online/offline)
  - Row 3: Two-column charts (Worker Phase PieChart + Team Readiness BarChart)
  - Row 4: Two-column (Activity Feed from notification store + Infrastructure Health cards with progress bars)
  - Row 5: Quick Actions bar (Create Worker, Create Team, Create Human, Matrix Chat, View Skills)
- **New Components**: `PhaseMiniBar`, `ActivityFeedItem`, `HealthCard`
- **New Hook**: `useRefreshCountdown` (15s countdown display)
- **Enhanced**: `AnimatedStat` now accepts `sub` prop for sub-content
- **Imports**: Uses `WORKER_PHASE_COLORS` from `@/lib/phase-colors` (created by batch1-core)
- **Uses**: `useNotificationStore` for real-time activity feed

### Modified: Data hooks (refetchInterval: 30000/60000 → 15000)
- `src/hooks/use-hiclaw-workers.ts`
- `src/hooks/use-hiclaw-teams.ts`
- `src/hooks/use-hiclaw-managers.ts`
- `src/hooks/use-hiclaw-humans.ts`
- `src/hooks/use-hiclaw-infrastructure.ts`

### Note: `src/lib/phase-colors.ts`
Already existed from batch1-core task. Uses `WORKER_PHASE_COLORS` (not `PHASE_COLORS`).

## Verification
- ESLint: No new errors (2 pre-existing in other files)
- Dev server: Compiles and serves successfully (GET / 200)
