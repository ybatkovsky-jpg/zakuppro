---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Create DraggableProjectCard component

Extract the project card motion.div (lines 200-289) into a DraggableProjectCard component that uses useDraggable hook. The card should: accept project, column config, and callbacks; apply draggable attributes to card wrapper; show GripVertical icon as drag handle; use isDragging state for opacity reduction; preserve existing card styling and animations. This isolates DnD logic from rendering.

## Inputs

- `src/components/app/projects.tsx`

## Expected Output

- `src/components/app/projects.tsx`

## Verification

grep -q 'useDraggable' src/components/app/projects.tsx && grep -q 'DraggableProjectCard' src/components/app/projects.tsx

## Observability Impact

isDragging state provides visual feedback during drag operations
