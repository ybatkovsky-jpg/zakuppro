---
id: T05
parent: S02
milestone: M005
key_files:
  - src/components/app/projects.tsx
key_decisions:
  - Extracted statusMutation to parent component for proper React Query integration with query invalidation
  - Used mutation's onSuccess callback for success toast instead of inline try-catch
  - Removed unused queryClient from KanbanBoard since mutation handles invalidation
duration: 
verification_result: passed
completed_at: 2026-06-03T03:58:34.909Z
blocker_discovered: false
---

# T05: Added React Query mutation for status updates, replacing direct fetch in onDragEnd with proper mutation integration

**Added React Query mutation for status updates, replacing direct fetch in onDragEnd with proper mutation integration**

## What Happened

Created `statusMutation` using `useMutation` hook for drag-and-drop status updates. The mutation accepts `{ projectId, status, comment }` parameters, handles 400 errors for invalid transitions with toast notifications, invalidates ['projects'] query on success, and provides loading state. Updated `KanbanBoardProps` interface to include `statusMutation`, passed it to the component, and replaced the direct fetch call in `handleDragEnd` with `statusMutation.mutate()` using the onSuccess callback for success toast.

## Verification

All grep checks passed:
- useMutation: ✅ (imported from @tanstack/react-query)
- statusMutation: ✅ (defined and used)
- /api/projects: ✅ (endpoint path present)
- DndContext: ✅ (drag-and-drop context wrapper)
- onDragEnd: ✅ (handler function)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'useMutation' src/components/app/projects.tsx` | 0 | pass | 150ms |
| 2 | `grep -q 'statusMutation' src/components/app/projects.tsx` | 0 | pass | 120ms |
| 3 | `grep -q '/api/projects' src/components/app/projects.tsx` | 0 | pass | 130ms |
| 4 | `grep -q 'DndContext' src/components/app/projects.tsx` | 0 | pass | 110ms |
| 5 | `grep -q 'onDragEnd' src/components/app/projects.tsx` | 0 | pass | 100ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/components/app/projects.tsx`
