# Task batch6-layout - Agent Work Record

## Task: Improve the Main Dashboard Layout

## Changes Made

### File Modified: `src/components/dashboard/hi-claw-dashboard.tsx`

1. **Hash-based routing + localStorage persistence**
   - Created `useActiveSection` custom hook
   - On mount: reads `window.location.hash` first, then `localStorage('hiclaw-active-section')`, fallback to 'overview'
   - Listens for `hashchange` event to support browser back/forward
   - On section change: updates both `window.location.hash` and `localStorage`
   - Bookmarkable URLs like `#workers`, `#teams`, `#chat`, etc.

2. **Header Bar Improvements**
   - Added cluster status summary badges (Workers/Teams/Managers count) visible when connected (lg+ breakpoint)
   - Added "快速操作" (Quick Actions) dropdown using `DropdownMenu` component with:
     - 创建 Worker → navigates to workers section
     - 创建 Team → navigates to teams section  
     - 创建 Human → navigates to k8s section
     - 打开 Matrix 聊天 → navigates to chat section
   - New icons: `Zap` for quick actions button

3. **Bottom Status Bar**
   - Thin 7-height footer bar with:
     - Connection status icon + text (green WiFi when connected, amber when disconnected)
     - Latency display with color coding (green <100ms, amber <300ms, red ≥300ms)
     - Controller URL (protocol prefix stripped)
     - Last data refresh time (relative format: 刚刚/X秒前/X分钟前)
     - Auto-refresh interval display
     - Matrix connection status with sync indicator
   - Uses `Separator` component between sections
   - Fixed footer layout using `flex flex-col` on outer container

4. **Sidebar Improvements**
   - Count badges next to Workers/Teams/Managers items:
     - Expanded mode: right-aligned `Badge` component
     - Collapsed mode: top-right absolute positioned count bubble
   - Notification indicator dot (orange pulse) on sections with recent (5min) unread notifications
   - Notification matching by keyword analysis of title/message
   - Collapsed mode tooltips show label + count
   - Mobile sidebar also has badges and notification dots

5. **Performance Optimizations**
   - `useMemo` for `countMap` and `sectionsWithNotifications`
   - `useCallback` for `handleNavClick` and `handleQuickAction`

## New Imports
- `useMatrixStore` from `@/lib/matrix-store`
- `useNotificationStore` from `@/lib/notification-store`
- `useWorkers`, `useTeams`, `useManagers` hooks
- `Separator` from `@/components/ui/separator`
- `DropdownMenu*` from `@/components/ui/dropdown-menu`
- Icons: `Zap`, `Plus`, `Activity`, `Clock`, `Globe`, `RefreshCw`

## Verification
- ESLint: 0 errors, 1 pre-existing warning (workers-section.tsx)
