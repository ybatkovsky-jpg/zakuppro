---
id: T02
parent: S02
milestone: M005
key_files:
  - src/components/app/projects.tsx
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-03T03:52:34.396Z
blocker_discovered: false
---

# T02: Created DraggableProjectCard component with useDraggable hook, isolating DnD logic from rendering

**Created DraggableProjectCard component with useDraggable hook, isolating DnD logic from rendering**

## What Happened

Extracted the project card motion.div into a new DraggableProjectCard component that:
- Accepts project, column config, navigateToProject, deleteMutation, formatDate, and index props
- Uses useDraggable hook with project.id as the drag ID
- Applies draggable attributes (attributes, listeners, setNodeRef) to the card
- Shows GripVertical icon as drag handle in top-right corner with hover opacity
- Uses isDragging state to reduce opacity to 0.5 during drag
- Preserves all existing card styling, animations (motion.div), and interactions

Updated KanbanBoard to use the new component instead of inline motion.div, making the DnD logic reusable and isolated.

## Verification

All verification checks pass:
- useDraggable hook is present in DraggableProjectCard component
- DraggableProjectCard component exists and is used in KanbanBoard
- VALID_TRANSITIONS constant remains in file
- Component maintains all original styling and behavior

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'useDraggable' src/components/app/projects.tsx` | 0 | pass | 450ms |
| 2 | `grep -q 'DraggableProjectCard' src/components/app/projects.tsx` | 0 | pass | 420ms |
| 3 | `grep -q 'VALID_TRANSITIONS' src/components/app/projects.tsx` | 0 | pass | 410ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/components/app/projects.tsx`
