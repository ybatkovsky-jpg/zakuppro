---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T03: Convert columns to droppable zones

Wrap KanbanBoard column divs with useDroppable hook. Each column's droppable ID should match its status value ('new', 'processing', etc.). Add isOver state for column highlight when dragging over. The column body div (line 190) becomes the droppable node ref. This creates drop targets for draggable cards.

## Inputs

- `src/components/app/projects.tsx`

## Expected Output

- `src/components/app/projects.tsx`

## Verification

grep -q 'useDroppable' src/components/app/projects.tsx && grep -q 'setNodeRef' src/components/app/projects.tsx

## Observability Impact

isOver state enables visual highlight on valid drop zone
