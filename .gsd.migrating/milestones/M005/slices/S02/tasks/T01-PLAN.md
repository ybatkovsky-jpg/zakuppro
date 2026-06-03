---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: Add @dnd-kit imports and create DnD constants

Import DndContext, useDraggable, useDroppable, closestCenter, DragOverlay, and useDroppableContext/useSensors/useSensor/PointerSensor from @dnd-kit/core. Copy VALID_TRANSITIONS constant from status route to projects.tsx for client-side validation. This task establishes the foundation for DnD integration.

## Inputs

- `src/components/app/projects.tsx`
- `src/app/api/projects/[id]/status/route.ts`

## Expected Output

- `src/components/app/projects.tsx`

## Verification

grep -q '@dnd-kit/core' src/components/app/projects.tsx && grep -q 'VALID_TRANSITIONS' src/components/app/projects.tsx

## Observability Impact

None - constants only
