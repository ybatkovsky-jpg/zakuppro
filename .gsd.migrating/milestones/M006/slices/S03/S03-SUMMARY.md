---
id: S03
parent: M006
milestone: M006
provides:
  - (none)
requires:
  []
affects:
  - M006 milestone completion: all 3 slices (S01 stock reservation, S02 transition guard, S03 readiness matrix) now deliver the business logic polish vision
key_files:
  - backend/services/transition_service.py
  - backend/schemas.py
  - backend/routers/projects.py
  - backend/tests/test_readiness.py
  - src/types/fastapi.ts
  - src/lib/api/projects.ts
  - src/app/api/projects/readiness/route.ts
  - src/components/app/projects.tsx
  - src/components/app/dashboard.tsx
key_decisions:
  - Renamed _PRODUCTION_READY_STATUSES to PRODUCTION_READY_STATUSES (public) for cross-module consumption by readiness endpoint
  - Placed readiness route BEFORE /{project_id} in FastAPI router to avoid path-parameter conflict (literal paths must precede parameterized paths)
  - Used GROUP BY aggregation query (not per-project loops) for readiness computation — single DB round-trip for all projects
  - Frontend readiness fetch is non-blocking (React Query enabled flag) — missing data hides dot instead of error state
  - Readiness response format camelCase from backend — no toCamelCase transform needed in Next.js proxy
patterns_established:
  - Shared PRODUCTION_READY_STATUSES constant exported from transition_service.py serves both transition guard (S02) and readiness computation (S03)
  - Supplementary UI data pattern: React Query with enabled flag, graceful degradation on missing data
  - Next.js App Router proxy route pattern: apiFetch to FastAPI, forward error status codes, direct JSON pass-through
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-06-04T10:54:24.995Z
blocker_discovered: false
---

# S03: Project Readiness Matrix

**Delivered GET /api/projects/readiness endpoint with green/yellow/red per-project readiness computed from ProjectItem statuses, plus colored indicator dots with click-to-expand tooltips on both Kanban and Dashboard views.**

## What Happened

S03 delivered the Project Readiness Matrix — the final M006 slice completing the business logic polish milestone. 

**T01 — Backend Readiness Endpoint:** Renamed the private `_PRODUCTION_READY_STATUSES` to public `PRODUCTION_READY_STATUSES` in `transition_service.py` for cross-module consumption. Added `ProjectReadinessResponse` Pydantic schema (project_id, project_name, readiness, ready_count, total_count, breakdown dict) to `schemas.py`. Created `GET /api/projects/readiness` placed before `/{project_id}` in the router to avoid path-parameter conflict. The endpoint uses RBAC (`require_role([Owner, Manager])`), applies ownership filtering (manager sees only own projects), batches status counts in a single GROUP BY query, then computes readability per project: green if all items are in `PRODUCTION_READY_STATUSES` or project is empty, yellow if no `К закупке` items but some aren't yet ready (`Запрошено`/`Счет получен`), red if any `К закупке`. Structured INFO log records project count and duration. Exported `ProjectReadinessResponse` from `schemas/__init__.py`. Created `test_readiness.py` with 12 tests covering all readiness levels, RBAC enforcement (401/403/200), ownership filtering, and edge cases (empty DB, single-item projects).

**T02 — Frontend API Layer:** Added `ProjectReadinessResponse` TypeScript interface (project_id, project_name, readiness union type, ready_count, total_count, breakdown as Record<string, number>). Added `fetchProjectReadiness()` API method using the existing `apiClient.get` pattern. Created Next.js App Router proxy route at `src/app/api/projects/readiness/route.ts` that forwards to FastAPI `GET /api/projects/readiness` via `apiFetch`, following the same error-handling pattern as the existing projects proxy. Response keys are already camelCase from the backend so no `toCamelCase` transform is needed.

**T03 — Frontend UI Indicators:** Fixed a critical bug in KanbanBoard where `readinessMap` was not being passed to `KanbanColumn` (missing prop in the `KANBAN_COLUMNS.map` iterator) — this prevented readiness dots from appearing on Kanban cards entirely. Added full readiness indicator support to Dashboard: imports for Popover components, `fetchProjectReadiness`, and `ProjectReadinessResponse` type; non-blocking `useQuery` (enabled only when `recentProjects.length > 0`); `readinessMap` built from data keyed by project ID; `READINESS_COLORS` and `READINESS_LABELS` helper constants; colored readiness dot next to each project's status badge in the Recent Projects section with click-to-expand Popover showing per-status item counts. Both views: empty projects show green dot; missing readiness data gracefully hides the indicator.

All 64 backend tests pass (12 readiness + 36 stock_service + 16 transition_service). TypeScript compilation clean for modified files. No regressions.

## Verification

**Backend Tests** (`python -m pytest backend/tests/test_readiness.py backend/tests/test_stock_service.py backend/tests/test_transition_service.py -v --tb=short`): All 64 tests passed — 12 readiness tests (green_all_ready, green_empty_project, yellow_in_transit, red_has_k_zakupke, mixed_status_breakdown_accuracy, single_item_red, 401_no_token, 403_warehouse, 200_owner, 200_manager, ownership_filter_manager_sees_only_own, nonexistent_project_handling), 36 stock_service tests, 16 transition_service tests. Zero failures. Duration: 5.07s.

**Frontend Artifacts:** Proxy route `src/app/api/projects/readiness/route.ts` exists. TypeScript types file has `ProjectReadinessResponse` interface. API file has `fetchProjectReadiness` method. Both component files verified: `projects.tsx` (26 readiness references) and `dashboard.tsx` (15 readiness references).

**TypeScript Compilation:** `npx tsc --noEmit` — no new errors from readiness code. Pre-existing errors in unrelated files unchanged.

**Readiness Logic Verification:** Green for projects with all items in PRODUCTION_READY_STATUSES or empty. Yellow for projects with in-transit items but no К закупке. Red for projects with any К закупке items. Breakdown dict accurately reflects per-status counts. RBAC correctly enforced (401 no token, 403 warehouse, 200 owner/manager). Ownership filtering works (manager sees only own projects). Empty DB returns 200 with [].


## Requirements Advanced

- R014 — S03 delivers the complete readiness matrix: backend endpoint computes green/yellow/red per project from ProjectItem.status counts, frontend renders colored dots with click-to-expand tooltip breakdowns on both Kanban and Dashboard views

## Requirements Validated

- R014 — 12 backend tests verify readiness computation (green_all_ready, yellow_in_transit, red_has_k_zakupke, mixed_status_breakdown_accuracy, single_item_red, empty_project), RBAC enforcement (401/403/200), and ownership filtering. Frontend readiness dots confirmed in both projects.tsx (26 refs) and dashboard.tsx (15 refs). End-to-end path: DB status counts → FastAPI endpoint → Next.js proxy → React components with visual indicators.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

None.
