---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T03: Frontend UI: readiness dots on Kanban cards and Dashboard with tooltip breakdown

Why: The visual readiness indicators are the user-facing deliverable. Each project card needs a colored dot (green/amber/red) showing procurement readiness at a glance, with a click-to-expand tooltip showing per-status item counts.

Do:
1. In src/components/app/projects.tsx: Add a fetchReadiness React Query call (useQuery) that calls fetchProjectReadiness() from T02. Build a readinessMap: Record<string, ProjectReadinessResponse> keyed by project ID. In DraggableProjectCard (line 179), add a readiness indicator after the Stats Row (after line 285): a small colored dot (w-2.5 h-2.5 rounded-full) with bg-green-500 / bg-amber-500 / bg-red-500 plus a Popover/Tooltip on click showing a mini-table of status→count from breakdown. The dot should sit inline near the item count badge. Handle loading state (dot hidden or skeleton), error state (dot hidden), and missing readiness data gracefully.
2. In src/components/app/dashboard.tsx: Add the same fetchReadiness query. In the recent projects section (line 1941), add a readiness dot next to the status badge (line 1964) or next to the item count (line 1977). Use the same colored dot + tooltip pattern as the Kanban. Handle empty state (no readiness data yet) by hiding the dot.
3. Both components: do NOT block rendering on readiness fetch — use enabled: !!projectsData to fetch only after projects are loaded. The readiness data is supplementary visual information, not a requirement for basic card rendering.

Done when: Kanban shows colored dots on each card; Dashboard shows colored dots on recent project cards; clicking a dot shows a tooltip with per-status item counts; empty projects show green dot; projects with mixed status show correct colors (green/amber/red).

## Inputs

- `src/components/app/projects.tsx`
- `src/components/app/dashboard.tsx`
- `src/lib/api/projects.ts`
- `src/types/fastapi.ts`
- `src/lib/api-client.ts`

## Expected Output

- `src/components/app/projects.tsx`
- `src/components/app/dashboard.tsx`

## Verification

grep -q 'readiness' D:/CLAUDE/Project/zakuppro/zakuppro/src/components/app/projects.tsx
