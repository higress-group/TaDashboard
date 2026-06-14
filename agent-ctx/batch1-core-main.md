# Task batch1-core — Work Summary

## Tasks Completed

### 1. Fixed Settings Dialog (`src/components/dashboard/settings-dialog.tsx`)
- **handleTest fix**: No longer calls `setControllerUrl(tempUrl)`. Now directly fetches `/api/hiclaw/healthz?controllerUrl=...` with `tempUrl`, storing the result in local `testResult` state without mutating global store.
- **Removed auto-reconnect from dialog**: The `useEffect` that managed auto-reconnect inside the dialog has been removed. Auto-reconnect is now handled globally in the store.
- **Added Matrix Homeserver URL field**: Reads from `useInfrastructure()` hook and displays the `matrix.homeserver` value as a read-only field.
- **Added Connection History section**: Shows last 5 connection attempts with timestamp, URL, status (success/fail), latency, and error message.

### 2. Fixed Connection Banner (`src/components/dashboard/connection-banner.tsx`)
- **Added "重试" (Retry) button**: Directly in the banner, calls `checkConnection()`.
- **Added auto-reconnect countdown**: Shows seconds until next reconnect attempt.
- **Changed from destructive (red) to warning (amber)**: Uses `bg-amber-500/10`, `border-amber-500/20`, `text-amber-600` for better visual hierarchy.
- **Shows the controller URL being attempted**: Displays `controllerUrl` in the banner.

### 3. Added Global Auto-Reconnect to Store (`src/lib/hiclaw-store.ts`)
- **`autoReconnect` boolean** (persisted via partialize)
- **`reconnectInterval` number** (persisted, default 15000ms)
- **`setAutoReconnect` action**
- **`setReconnectInterval` action**
- **`lastConnectedAt` timestamp** (persisted)
- **`connectionLatency` number**
- **`connectionHistory`** (ConnectionAttempt[], last 5)
- **Auto-reconnect effect in store**: Uses `useHiClawStore.subscribe()` to monitor state changes. Starts interval when `autoReconnect && !isConnected && !settingsOpen`, stops when connected or disabled.

### 4. Extracted Shared Phase Colors (`src/lib/phase-colors.ts`)
- `WORKER_PHASE_COLORS`, `TEAM_PHASE_COLORS`, `MANAGER_PHASE_COLORS`, `RUNTIME_COLORS` (hex colors for charts)
- `WORKER_PHASE_LABELS`, `TEAM_PHASE_LABELS`, `MANAGER_PHASE_LABELS`, `RUNTIME_LABELS` (Chinese labels)
- `WORKER_PHASE_BADGE_CLASSES`, `TEAM_PHASE_BADGE_CLASSES`, `MANAGER_PHASE_BADGE_CLASSES` (Tailwind classes for Badge components)
- `phaseToBadgeVariant()` helper function
- Updated all 4 section files to use the shared exports instead of local duplicates.

### 5. Deleted dead file `src/components/dashboard/dashboard-data.ts`

### Bonus fixes
- Fixed pre-existing lint error in `chat-section.tsx` (setState in effect)
- Fixed duplicate import in `overview-section.tsx` (both `PHASE_COLORS` and `WORKER_PHASE_COLORS` from phase-colors)

## Verification
- `bun run lint` — passes (0 errors)
- `next build` — compiles successfully
