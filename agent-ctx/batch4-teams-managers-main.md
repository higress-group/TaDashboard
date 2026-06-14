# Task: batch4-teams-managers

## Summary
Improved Teams and Managers sections with visual topology, quick actions, table views, shared colors, sorting, and auto-refresh.

## Files Modified
- `src/components/dashboard/sections/teams-section.tsx` - Full rewrite with 6 improvements
- `src/components/dashboard/sections/managers-section.tsx` - Full rewrite with 4 improvements
- `worklog.md` - Appended work log entry

## Teams Section Changes
1. **Team Topology Visualization**: Replaced simple text list with visual SVG diagram (Manager→Team→Workers with arrows, colored borders, icons, status dots)
2. **Add Worker Quick Action**: Popover on each team card showing available workers (filtered to not-in-team + unassigned)
3. **Shared Phase Colors**: Using TEAM_PHASE_LABELS and WORKER_PHASE_LABELS from @/lib/phase-colors
4. **Sort & Search**: Sort dropdown (name/phase/readiness), existing search preserved
5. **Auto-refresh**: Confirmed useTeams hook already has refetchInterval: 15000
6. **Extracted IIFE**: TeamWorkersList sub-component replaces inline IIFE

## Managers Section Changes
1. **Improved Cards**: Model name prominent, runtime badge with RUNTIME_LABELS, welcome sent status (CheckCircle2/XCircle icons), Matrix user ID + Room ID with copy buttons (TruncatedId component)
2. **Shared Phase Colors**: Using MANAGER_PHASE_LABELS and RUNTIME_LABELS from @/lib/phase-colors
3. **Table View**: Card/table toggle with Table component (columns: name/phase/model/runtime/welcome/Matrix ID/actions)
4. **Auto-refresh**: Confirmed useManagers hook already has refetchInterval: 15000

## New Sub-components
- `TeamWorkersList` - Displays workers belonging to a team (extracted from IIFE)
- `TeamTopologyDiagram` - Visual topology for a single team (Manager→Team Room→Workers)
- `CopyButton` - Clipboard copy with visual feedback
- `TruncatedId` - Truncated ID display with tooltip and copy button

## Verification
- ESLint: 0 errors, 0 warnings
- TypeScript: No new errors
- Fixed type error: TeamTopologyDiagram managers prop type changed to ManagerResponse[]
