# S02: Kanban Drag-and-Drop

**Goal:** Implement drag-and-drop functionality for the Kanban board in projects.tsx using @dnd-kit library with transition validation against VALID_TRANSITIONS and status persistence via FastAPI backend.
**Demo:** Пользователь может перетащить карточку проекта из колонки 'Новые' в 'В обработке'. Статус обновляется в БД через FastAPI. Переходы подчиняются правилам VALID_TRANSITIONS.

## Must-Haves

- Users can drag project cards between Kanban status columns (new → processing → requested → invoiced → paid → delivered → completed)
- Invalid transitions are prevented with toast error feedback (e.g., cannot drag from completed → new)
- Valid transitions update project status in PostgreSQL via FastAPI API
- Visual feedback during drag: card appears at cursor, target column highlights, card opacity changes
- React Query cache invalidation after successful status change

## Proof Level

- This slice proves: integration

## Integration Closure

- DnD context wraps KanbanBoard component
- onDragEnd handler validates transition → calls status API → invalidates queries
- Column IDs match status values for droppable zones
- Card IDs match project IDs for draggable items

## Verification

- Console logs on drag start/end for debugging
- Toast notifications for success/error feedback
- API errors logged to console in mutation onError

## Tasks

- [x] **T01: Add @dnd-kit imports and create DnD constants** `est:15m`
  Import DndContext, useDraggable, useDroppable, closestCenter, DragOverlay, and useDroppableContext/useSensors/useSensor/PointerSensor from @dnd-kit/core. Copy VALID_TRANSITIONS constant from status route to projects.tsx for client-side validation. This task establishes the foundation for DnD integration.
  - Files: `src/components/app/projects.tsx`
  - Verify: grep -q '@dnd-kit/core' src/components/app/projects.tsx && grep -q 'VALID_TRANSITIONS' src/components/app/projects.tsx

- [x] **T02: Create DraggableProjectCard component** `est:30m`
  Extract the project card motion.div (lines 200-289) into a DraggableProjectCard component that uses useDraggable hook. The card should: accept project, column config, and callbacks; apply draggable attributes to card wrapper; show GripVertical icon as drag handle; use isDragging state for opacity reduction; preserve existing card styling and animations. This isolates DnD logic from rendering.
  - Files: `src/components/app/projects.tsx`
  - Verify: grep -q 'useDraggable' src/components/app/projects.tsx && grep -q 'DraggableProjectCard' src/components/app/projects.tsx

- [x] **T03: Convert columns to droppable zones** `est:20m`
  Wrap KanbanBoard column divs with useDroppable hook. Each column's droppable ID should match its status value ('new', 'processing', etc.). Add isOver state for column highlight when dragging over. The column body div (line 190) becomes the droppable node ref. This creates drop targets for draggable cards.
  - Files: `src/components/app/projects.tsx`
  - Verify: grep -q 'useDroppable' src/components/app/projects.tsx && grep -q 'setNodeRef' src/components/app/projects.tsx

- [x] **T04: Implement DnD context and onDragEnd handler** `est:45m`
  Wrap KanbanBoard content in DndContext with sensors (PointerSensor) and collisionDetection (closestCenter). Implement onDragEnd handler that: extracts active.id (project) and over?.id (target column); validates transition via VALID_TRANSITIONS; calls POST /api/projects/[id]/status with status and optional comment; invalidates React Query ['projects'] on success; shows toast on error for invalid transitions. Add DragOverlay for visual polish during drag.
  - Files: `src/components/app/projects.tsx`
  - Verify: grep -q 'DndContext' src/components/app/projects.tsx && grep -q 'onDragEnd' src/components/app/projects.tsx && grep -q '/api/projects' src/components/app/projects.tsx

- [x] **T05: Add React Query mutation for status updates** `est:30m`
  Create a useMutation hook for status change API calls (POST /api/projects/[id]/status). The mutation should: accept { projectId, status, comment }; handle 400 errors for invalid transitions with toast; invalidate ['projects'] query on success; show loading state during API call. Replace direct fetch in onDragEnd with this mutation for proper React Query integration.
  - Files: `src/components/app/projects.tsx`
  - Verify: grep -q 'useMutation' src/components/app/projects.tsx && grep -q 'statusMutation' src/components/app/projects.tsx

- [x] **T06: Add visual polish and touch support** `est:20m`
  Add DragOverlay component showing dragged card preview at cursor position. Configure sensors with TouchSensor for mobile support. Add visual styles: column highlight on isOver, card opacity reduction on isDragging, smooth transition animations. Ensure drag handle (GripVertical) is always visible on hover. This completes the DnD UX polish.
  - Files: `src/components/app/projects.tsx`
  - Verify: grep -q 'DragOverlay' src/components/app/projects.tsx && grep -q 'TouchSensor' src/components/app/projects.tsx

- [ ] **T07: Build verification and manual testing** `est:30m`
  Run TypeScript build to verify no errors. Create manual test checklist for: valid transition (new → processing), invalid transition (completed → new), API error handling, toast notifications, touch device functionality. Document test results in slice UAT. This verifies the slice delivers the claimed functionality.
  - Files: `src/components/app/projects.tsx`
  - Verify: npm run build 2>&1 | tail -10

## Files Likely Touched

- src/components/app/projects.tsx
