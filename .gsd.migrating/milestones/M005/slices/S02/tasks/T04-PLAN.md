---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T04: Implement DnD context and onDragEnd handler

Wrap KanbanBoard content in DndContext with sensors (PointerSensor) and collisionDetection (closestCenter). Implement onDragEnd handler that: extracts active.id (project) and over?.id (target column); validates transition via VALID_TRANSITIONS; calls POST /api/projects/[id]/status with status and optional comment; invalidates React Query ['projects'] on success; shows toast on error for invalid transitions. Add DragOverlay for visual polish during drag.

## Inputs

- `src/components/app/projects.tsx`
- `src/lib/api-client.ts`
- `src/app/api/projects/[id]/status/route.ts`

## Expected Output

- `src/components/app/projects.tsx`

## Verification

grep -q 'DndContext' src/components/app/projects.tsx && grep -q 'onDragEnd' src/components/app/projects.tsx && grep -q '/api/projects' src/components/app/projects.tsx

## Observability Impact

onDragEnd logs to console, toast notifications for user feedback, API errors in console
