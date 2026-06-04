# S03: Project Readiness Matrix

**Goal:** Add GET /api/projects/readiness endpoint returning per-project green/yellow/red readiness with item counts by procurement stage, wire readiness indicators into Kanban project cards and Dashboard recent projects, with click-to-expand breakdown tooltips.
**Demo:** Open the projects dashboard — each project card shows a colored indicator: green (all items На складе or Оплачено), yellow (some items in transit: Запрошено or Счет получен), red (some items still К закупке). Click through to see the breakdown by item status.

## Must-Haves

- Backend: readiness endpoint returns correct green/yellow/red per project, with item counts; RBAC enforced (owner/manager only); 10+ tests pass
- Frontend Kanban: each DraggableProjectCard shows colored readiness dot (green/amber/red) with tooltip breakdown on click
- Frontend Dashboard: each recent project card shows colored readiness dot with tooltip breakdown on click
- Existing tests (stock_service 36 + transition_service 16) continue to pass
- TypeScript compilation passes with no new errors

## Proof Level

- This slice proves: integration

## Integration Closure

- Upstream: transition_service.py (PRODUCTION_READY_STATUSES constant), projects.py (auth/RBAC/ownership patterns), stock_service.py (S01 guarantees correct reserved quantities), ProjectItem.status reliability (S02 transition guard)
- New wiring: readiness endpoint added to existing projects router (no new router file); Next.js proxy route forwards to FastAPI; frontend API method fetches via proxy; UI components consume via React Query
- End-to-end: full path from DB (ProjectItem.status counts) → FastAPI endpoint → Next.js proxy → frontend API client → React components with visual indicators
- What remains: nothing — this is the final M006 slice; after this, all 3 slices deliver the milestone vision

## Verification

- Structured INFO logs on readiness endpoint calls (project count, timing)
- DB query performance is inherently observable: per-project aggregation queries, no new tables
- Frontend: dot colors are self-documenting visual signals — green/amber/red directly visible to users
- Failure visibility: HTTP 500 on DB errors, 401/403 on auth failures — same patterns as existing endpoints

## Tasks

- [x] **T01: Backend readiness endpoint with schema, constant export, and tests** `est:1.5h`
  Why: The backend readiness endpoint is the data foundation for the entire slice. It computes per-project readiness from ProjectItem.status counts using the same PRODUCTION_READY_STATUSES set that S02's transition guard uses.
  - Files: `backend/services/transition_service.py`, `backend/schemas.py`, `backend/routers/projects.py`, `backend/tests/test_readiness.py`
  - Verify: cd D:/CLAUDE/Project/zakuppro/zakuppro && python -m pytest backend/tests/test_readiness.py backend/tests/test_stock_service.py backend/tests/test_transition_service.py -v --tb=short

- [x] **T02: Frontend API layer: TypeScript types, API method, and Next.js proxy route** `est:45m`
  Why: The frontend needs a typed API method and Next.js proxy to forward readiness requests from the browser to the FastAPI backend. This follows the exact same pattern as the existing projects proxy.
  - Files: `src/types/fastapi.ts`, `src/lib/api/projects.ts`, `src/app/api/projects/readiness/route.ts`
  - Verify: test -f D:/CLAUDE/Project/zakuppro/zakuppro/src/app/api/projects/readiness/route.ts

- [x] **T03: Frontend UI: readiness dots on Kanban cards and Dashboard with tooltip breakdown** `est:1.5h`
  Why: The visual readiness indicators are the user-facing deliverable. Each project card needs a colored dot (green/amber/red) showing procurement readiness at a glance, with a click-to-expand tooltip showing per-status item counts.
  - Files: `src/components/app/projects.tsx`, `src/components/app/dashboard.tsx`
  - Verify: grep -q 'readiness' D:/CLAUDE/Project/zakuppro/zakuppro/src/components/app/projects.tsx

## Files Likely Touched

- backend/services/transition_service.py
- backend/schemas.py
- backend/routers/projects.py
- backend/tests/test_readiness.py
- src/types/fastapi.ts
- src/lib/api/projects.ts
- src/app/api/projects/readiness/route.ts
- src/components/app/projects.tsx
- src/components/app/dashboard.tsx
