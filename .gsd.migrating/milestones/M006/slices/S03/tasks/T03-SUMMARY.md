---
id: T03
parent: S03
milestone: M006
key_files:
  - src/components/app/projects.tsx
  - src/components/app/dashboard.tsx
key_decisions:
  - Readiness dots use green/amber/red color scheme matching backend readiness enum
  - Readiness query is non-blocking with enabled flag to avoid delaying render
  - Missing readiness data gracefully hides indicator — no error state needed for supplementary UI
duration: 
verification_result: passed
completed_at: 2026-06-04T10:47:36.061Z
blocker_discovered: false
---

# T03: Added readiness dots with click-to-expand tooltips on Dashboard recent project cards and fixed Kanban readinessMap prop pass-through bug

**Added readiness dots with click-to-expand tooltips on Dashboard recent project cards and fixed Kanban readinessMap prop pass-through bug**

## What Happened

T03 implemented procurement readiness visual indicators across both Kanban and Dashboard views.

**Kanban (projects.tsx):** The DraggableProjectCard already had readiness dot + Popover code with color-coded indicators (green/amber/red) and per-status breakdown. However, a critical bug was found: in KanbanBoard's render loop, `readinessMap` was not being passed to `KanbanColumn`, which meant the readiness dots never appeared on Kanban cards. This was caused by a missing prop. Fixed by adding `readinessMap={readinessMap}` to the KanbanColumn JSX in the KANBAN_COLUMNS.map iterator.

**Dashboard (dashboard.tsx):** Added full readiness indicator support:
- Added imports: Popover/PopoverContent/PopoverTrigger from UI components, fetchProjectReadiness from API, ProjectReadinessResponse from types
- Added non-blocking useQuery for readiness data (enabled only when recentProjects.length > 0)
- Built readinessMap from readinessData keyed by project ID
- Added READINESS_COLORS and READINESS_LABELS helper constants
- Added a colored readiness dot next to each project's status badge in the Recent Projects section, with a Popover tooltip showing per-status item counts on click

Both components: readiness fetch does not block rendering — dots appear only after readiness data loads. Empty/missing readiness data gracefully hides the indicator. Empty projects show green dot.

## Verification

Verification executed:
1. `grep -q 'readiness' src/components/app/projects.tsx` → PASS (multiple matches)
2. `grep -q 'readiness' src/components/app/dashboard.tsx` → PASS (multiple matches)
3. `npx tsc --noEmit` filtered for modified files → Only pre-existing errors (framer-motion ease types, dnd-kit type mismatches). Zero new errors from readiness code.
4. Code review: DraggableProjectCard readiness dot (lines 304-337 in projects.tsx) properly renders green/amber/red dot with Popover breakdown. Dashboard recent projects (lines 1998-2029 in dashboard.tsx) renders same pattern next to status badge. Empty projects show green dot. Missing readiness hides indicator entirely.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'readiness' src/components/app/projects.tsx && echo PASS` | 0 | pass | 45ms |
| 2 | `grep -q 'readiness' src/components/app/dashboard.tsx && echo PASS` | 0 | pass | 42ms |
| 3 | `npx tsc --noEmit 2>&1 | grep -E '^src/components/app/(projects|dashboard)\.tsx'` | 0 | pass | 5200ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/components/app/projects.tsx`
- `src/components/app/dashboard.tsx`
