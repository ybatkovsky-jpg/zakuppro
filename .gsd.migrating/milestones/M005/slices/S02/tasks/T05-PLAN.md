---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T05: Add React Query mutation for status updates

Create a useMutation hook for status change API calls (POST /api/projects/[id]/status). The mutation should: accept { projectId, status, comment }; handle 400 errors for invalid transitions with toast; invalidate ['projects'] query on success; show loading state during API call. Replace direct fetch in onDragEnd with this mutation for proper React Query integration.

## Inputs

- `src/components/app/projects.tsx`
- `src/app/api/projects/[id]/status/route.ts`

## Expected Output

- `src/components/app/projects.tsx`

## Verification

grep -q 'useMutation' src/components/app/projects.tsx && grep -q 'statusMutation' src/components/app/projects.tsx

## Observability Impact

Mutation loading state, error/success toasts provide clear user feedback
