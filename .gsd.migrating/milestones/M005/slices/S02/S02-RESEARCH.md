# S02: Kanban Drag-and-Drop - Research

## Overview

Slice S02 adds drag-and-drop (DnD) functionality to the existing Kanban board in `src/components/app/projects.tsx`. Users will be able to drag project cards between status columns, with validation against `VALID_TRANSITIONS` and status updates persisted via FastAPI.

## Key Findings

### 1. Existing Kanban Board is Well-Structured

The `KanbanBoard` component (lines 144-301 in `projects.tsx`) is already implemented with:
- 8 status columns defined in `KANBAN_COLUMNS` array
- Column layout with headers, badges, and scrollable bodies
- Project cards rendered via `motion.div` with AnimatePresence
- Static GripVertical icon (line 211-213) - already styled for DnD visual hint
- View mode toggle (table/kanban) at line 699-720

**Status mapping from frontend (English) to backend (Russian) is already defined** in `src/app/api/projects/[id]/status/route.ts`:
```typescript
const STATUS_TO_FASTAPI: Record<string, string> = {
  'new': 'Проектирование',
  'processing': 'Закупки',
  'paid': 'Оплачено',
  'delivered': 'Доставлено',
  'cancelled': 'Отменен',
  'requested': 'Закупки',
  'invoiced': 'На оплате',
  'completed': 'Завершен',
}
```

### 2. VALID_TRANSITIONS Already Exists

The transition validation logic is fully implemented in the status route:
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  'new': ['processing', 'cancelled'],
  'processing': ['requested', 'cancelled'],
  'requested': ['invoiced', 'processing', 'cancelled'],
  'invoiced': ['paid', 'requested', 'cancelled'],
  'paid': ['delivered', 'invoiced'],
  'delivered': ['completed', 'paid'],
  'completed': [],
  'cancelled': [],
}
```

This means:
- Frontend DnD can use this for client-side validation
- Backend API already validates transitions on POST `/api/projects/[id]/status`

### 3. @dnd-kit Already Installed

From `package.json`:
```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2",
```

The decision to use @dnd-kit was documented in MEM093 - chosen over react-beautiful-dnd (deprecated) and react-dnd (complex setup).

### 4. @dnd-kit API Pattern

The library exports:
- `DndContext` - wrapper component with `onDragEnd` handler
- `useDraggable` - hook for draggable items (cards)
- `useDroppable` - hook for drop zones (columns)
- `DragOverlay` - optional visual overlay during drag
- `closestCenter` - collision detection algorithm

**Key Event Types:**
```typescript
interface DragEndEvent {
  active: Active;        // { id, data, rect }
  over: Over | null;     // { id, rect, disabled, data }
  activatorEvent: Event;
  delta: Translate;
  collisions: Collision[] | null;
}
```

### 5. Backend Status Update Endpoint

`POST /api/projects/[id]/status` already exists and:
- Validates transition against `VALID_TRANSITIONS`
- Fetches current project state
- Returns 400 for invalid transitions
- Translates English→Russian status for FastAPI
- Supports optional `comment` for mandatory transitions (like 'cancelled')

Request body:
```typescript
{ status: string; comment?: string; changedAt?: string }
```

### 6. React Query Available

The project uses `@tanstack/react-query` for data fetching (see `projects.tsx` lines 327-340, 344-366). The DnD mutation should:
- Use `useMutation` hook
- Invalidate `['projects']` query on success
- Show toast notification on success/error

## Implementation Landscape

### Files to Modify

1. **`src/components/app/projects.tsx`** (main file)
   - Import `DndContext`, `useDraggable`, `useDroppable`, `closestCenter` from `@dnd-kit/core`
   - Import `DragOverlay` from `@dnd-kit/core` (optional for visual polish)
   - Wrap `KanbanBoard` content in `DndContext` with `onDragEnd` handler
   - Convert column `div` to use `useDroppable` hook
   - Convert project card `motion.div` to use `useDraggable` hook
   - Add optimistic update via React Query mutation
   - Add `pointer-events-none` during drag to prevent interaction issues
   - Handle invalid transitions with toast error

2. **`src/lib/api/projects.ts`** (new method)
   - Add `updateProjectStatus(id, status, comment?)` method
   - Or reuse existing status endpoint via `apiFetch`

### Constants to Reuse

- `KANBAN_COLUMNS` - column configuration (already exists)
- `VALID_TRANSITIONS` - can be imported from status route or duplicated
- `STATUS_TO_FASTAPI` - for backend translation

### New Components to Create

Consider creating a reusable DnD card component:
```typescript
// src/components/kanban/draggable-project-card.tsx
export function DraggableProjectCard({ project, ... }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: project.id })
  // ...
}
```

### Validation Flow

1. **Client-side pre-validation**: Check `VALID_TRANSITIONS[currentStatus].includes(targetStatus)`
2. **If invalid**: Show toast error, revert visual state
3. **If valid**: Call API mutation
4. **On API error**: Show toast, revert visual state
5. **On success**: Invalidate queries, show success toast

### Visual Feedback

- `isDragging` state from `useDraggable` for dimming/reducing opacity
- `isOver` state from `useDroppable` for column highlight
- `DragOverlay` for showing dragged card at cursor position
- AnimatePresence already handles exit animations

## Constraints & Gotchas

1. **Status Language Mismatch**: Frontend uses English (`new`, `processing`), FastAPI uses Russian (`Проектирование`, `Закупки`). The `STATUS_TO_FASTAPI` mapping handles this.

2. **Unknown Status Handling**: Cards with unknown status currently default to 'new' column (line 164-165 in projects.tsx). This should be preserved in DnD implementation.

3. **Motion Animation Conflict**: @dnd-kit uses transforms for drag position. The existing `framer-motion` animations should NOT interfere if `motion.div` wraps the draggable element.

4. **Touch Support**: @dnd-kit works on touch devices out of the box. No additional configuration needed.

5. **Column IDs**: Each column needs a unique droppable ID matching the status value (e.g., `'new'`, `'processing'`).

6. **React Query Cache**: After successful DnD, need to invalidate `['projects']` query to refetch with new status. Consider optimistic updates for instant feedback.

## Don't Hand-Roll

- **Custom collision detection**: Use `closestCenter` or `closestCorners` from @dnd-kit
- **Scroll handling**: @dnd-kit's auto-scroll works out of the box
- **Touch gestures**: PointerSensor handles both mouse and touch
- **Transform calculations**: @dnd-kit manages all positioning transforms

## Verification

1. **Manual Testing**:
   - Drag card from 'Новые' → 'В обработке'
   - Attempt invalid transition (e.g., 'Завершён' → 'Новый')
   - Verify status updates in DB via FastAPI
   - Test on mobile/touch device

2. **Type Checking**:
   - `npm run build` must pass
   - No TypeScript errors from @dnd-kit types

3. **Visual Regression**:
   - Kanban layout unchanged when not dragging
   - Drag overlay appears correctly
   - Column highlight on hover over drop zone

## First Proof

Start with minimal DnD implementation:
1. Wrap `KanbanBoard` in `DndContext`
2. Make one column droppable
3. Make one card draggable
4. Log `onDragEnd` event to console
5. Verify event contains correct `active.id` and `over?.id`

This validates the @dnd-kit integration before adding mutation logic.

## Sources

- @dnd-kit TypeScript definitions in `node_modules/@dnd-kit/core/dist/`
- Existing Kanban board in `src/components/app/projects.tsx`
- Status API route in `src/app/api/projects/[id]/status/route.ts`
- MEM093: @dnd-kit library decision
- MEM099: Frontend/backend status language mismatch
