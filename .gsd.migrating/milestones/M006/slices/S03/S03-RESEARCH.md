# S03 Research: Project Readiness Matrix

**Date:** 2026-06-04
**Risk:** low
**Depends on:** S01 (stock integrity), S02 (transition guard ensures ProjectItem.status reliability)

## Summary

Add a single `GET /api/projects/readiness` endpoint that returns per-project readiness (green/yellow/red) with item counts by procurement stage. Wire a colored dot indicator into project cards on both the Dashboard and Kanban views. No new service layer needed — readiness logic is a simple counting query on ProjectItem.status, reusing the ready-status set already defined in `transition_service._PRODUCTION_READY_STATUSES`.

## Recommendation

**Backend**: New endpoint on the existing `projects` router. One new Pydantic schema, no new service file. The logic is a single aggregated DB query — too simple to warrant a dedicated service.

**Frontend**: New typed API method `fetchProjectReadiness()` returning readiness for all projects. Overlay a colored dot on existing project cards in both `dashboard.tsx` and `projects.tsx`. Click-through to a breakdown modal showing per-status item counts.

**Task split**: Two independent work units (backend endpoint + tests, frontend integration) plus a third integration-verification task.

## Requirements

### R014 — Матрица готовности проекта (operability, active)
- **Owner**: S03 (primary)
- **Supported by**: S01 (stock quantities accurate), S02 (ProjectItem.status reliable)
- **What's needed**: Color indicator per project, click-through for item breakdown
- **Status values are guaranteed accurate** by S02 guard: no premature production transitions mean ProjectItem.status faithfully reflects procurement stage

## Architecture Decisions

### Color classification rules (per roadmap)

| Color | Rule | Meaning |
|-------|------|---------|
| `green` | All items status in {"На складе", "Оплачено"} | Fully ready for production |
| `yellow` | No "К закупке" items, and at least one not-yet-ready item {"Запрошено", "Счет получен"} | Procurement in progress |
| `red` | At least one item with status "К закупке" | Procurement hasn't started for some items |

Edge cases:
- **Empty project (no items)**: `green` — nothing to worry about
- **Items with "В производстве"**: Treat as ready (counts toward green, like "На складе"/"Оплачено"). Rare in practice since S02 guard prevents transition with non-ready items.
- **Single-item project with "К закупке"**: `red`
- **Items with null/empty status**: Treat as "К закупке" (worst-case assumption)

### Ready-status source of truth

Reuse `transition_service._PRODUCTION_READY_STATUSES = {"На складе", "Оплачено"}`. Import this constant into the readiness endpoint rather than duplicating the set. This keeps the definition of "ready" in one place. If the set ever changes, both the transition guard and readiness matrix update together.

IMPORTANT CAVEAT: `_PRODUCTION_READY_STATUSES` has a leading underscore (private-by-convention). Either import it as-is with a comment explaining the deliberate coupling, or extract it to a shared module-level constant. Recommendation: extract to module level as `PRODUCTION_READY_STATUSES` (remove underscore) since it's now consumed by two services. This is a one-line change in `transition_service.py` and a clean import in the readiness code.

### Endpoint design: `GET /api/projects/readiness`

**Choice**: Dedicated readiness endpoint (not extending existing list response).

**Rationale**:
- The existing `GET /api/projects` returns `List[ProjectResponse]` which already includes `items: List[ProjectItemResponse]` — enough data for the frontend to compute readiness locally. BUT:
  - Computing on backend is more efficient (single aggregated query vs fetching all items for all projects)
  - Backend is the single source of truth for business logic (MEM092)
  - Frontend currently uses Prisma for dashboard data (`/api/stats`) which doesn't have ProjectItem access
  - A dedicated endpoint can be optimized to a single `GROUP BY` query per project

**Endpoint**: `GET /api/projects/readiness`
- **Auth**: `[Role.OWNER, Role.MANAGER]` — same as existing project endpoints. Warehouse role excluded (no project access per existing RBAC).
- **Query params**: `skip`, `limit` (consistent with `list_projects`) — but likely not needed initially since readiness is typically fetched for all visible projects.
- **Response**: `List[ProjectReadinessResponse]`

**Response schema**:
```python
class ProjectReadinessResponse(BaseSchema):
    project_id: int
    project_name: str
    readiness: str  # "green" | "yellow" | "red"
    ready_count: int       # items with status in PRODUCTION_READY_STATUSES
    total_count: int       # total ProjectItems for this project
    breakdown: dict[str, int]  # e.g. {"На складе": 3, "Оплачено": 2, "Запрошено": 1}
```

**DB query approach**: Single query per project is acceptable (projects are never in the thousands). Pattern:
1. Query all projects (with ownership filter)
2. For each project, query `ProjectItem.status` with a `GROUP BY` aggregation
3. Compute readiness color from the breakdown
4. Return results

Alternative considered: single bulk query joining projects with project_items GROUP BY status. More efficient but requires raw SQL or complex SQLAlchemy. Not worth the complexity for this scale. Stick with the per-project pattern used elsewhere (like `can_transition_to`).

### Placement

Add to `backend/routers/projects.py` (reuses existing router prefix `/api/projects`). This keeps project-related endpoints together. No new router file needed.

## Implementation Landscape

### Backend changes (1 file new/changed)

#### 1. `backend/schemas.py` — New `ProjectReadinessResponse` schema
- Lines 112-119 (after `ProjectResponse`)
- `BaseSchema` subclass with `project_id`, `project_name`, `readiness`, `ready_count`, `total_count`, `breakdown`

#### 2. `backend/services/transition_service.py` — Export readiness constant (minor)
- Line 18: Remove underscore from `_PRODUCTION_READY_STATUSES` → `PRODUCTION_READY_STATUSES`
- Line 50: Update reference
- This is a rename only — no logic change. All existing tests pass.

#### 3. `backend/routers/projects.py` — New `GET /api/projects/readiness` endpoint
- After line 56 (after `list_projects`)
- Follows same auth pattern as `list_projects`:
  ```python
  current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
  db: Session = Depends(get_db)
  ```
- Query: load all projects (ownership filtered), then for each project aggregate ProjectItem.status counts
- Compute readiness from breakdown using the classification rules above
- Import `PRODUCTION_READY_STATUSES` from `backend.services.transition_service`

#### 4. `backend/tests/` — New test file or new test class in existing
- Pattern: follow `test_transition_service.py` structure
- Tests needed:
  - Green: all items ready (На складе/Оплачено)
  - Yellow: items in Запрошено/Счет получен only (no К закупке)
  - Red: at least one К закупке item
  - Empty project → green
  - Mixed status breakdown accuracy
  - RBAC: 401 without token, 403 for warehouse role
  - Ownership filter: manager sees only own projects
- ~10-12 tests

### Frontend changes (2-3 files changed)

#### 5. `src/lib/api/projects.ts` — New `fetchProjectReadiness()` method
- Add typed method calling `GET /api/projects/readiness` via Next.js proxy
- Types: `ProjectReadinessResponse { projectId, projectName, readiness, readyCount, totalCount, breakdown }`

#### 6. `src/app/api/projects/readiness/route.ts` — New Next.js proxy route
- Proxies `GET /api/projects/readiness` from FastAPI
- Follows the same pattern as `src/app/api/projects/route.ts`:
  - Bearer token forwarding
  - Snake-to-camelCase field mapping
  - Error forwarding

#### 7. `src/components/app/projects.tsx` — Readiness dot on Kanban cards
- Add readiness data fetch (can be combined with existing projects fetch or separate)
- In `DraggableProjectCard` (lines 179-293): add a small colored dot/indicator near the item count or status badge
- Green dot: `bg-green-500`, Yellow dot: `bg-amber-500`, Red dot: `bg-red-500`
- Optional: click on the dot toggles a tooltip/popover showing item count breakdown

#### 8. `src/components/app/dashboard.tsx` — Readiness dot on Dashboard cards
- Add readiness data fetch
- In the "Последние проекты" section (lines 1941-1986): add readiness indicator on each project card
- Note: Dashboard currently uses Prisma via `/api/stats` for data. The readiness fetch will be an additional API call. Consider refactoring the stats route to include readiness, or make a separate call. Recommendation: separate call — keeps Prisma stats route untouched and follows FastAPI-as-source-of-truth principle.

### Verification

#### Backend tests
```bash
cd D:/CLAUDE/Project/zakuppro/zakuppro && python -m pytest backend/tests/test_readiness.py -v --tb=short
# Expected: ~10-12 tests, all green
```

#### Full regression
```bash
cd D:/CLAUDE/Project/zakuppro/zakuppro && python -m pytest backend/tests/ -v --tb=line --ignore=backend/tests/test_imap_client.py
# Expected: no new failures beyond pre-existing 56
```

#### Frontend manual verification
- Open projects Kanban — each card shows colored readiness dot
- Open Dashboard — recent projects show readiness dot
- Hover/click on dot — see per-status item breakdown
- Verify: project with all "На складе"/"Оплачено" items → green
- Verify: project with "Запрошено" items → yellow
- Verify: project with "К закупке" items → red
- Verify: empty project → green

### Don't Hand-Roll

All infrastructure already exists:
- **Auth**: `require_role` from `backend.rbac`
- **Ownership filtering**: `apply_ownership_filter` from `backend.rbac`
- **DB session**: `get_db` from `backend.database`
- **Pydantic patterns**: `BaseSchema` with `from_attributes=True`
- **Ready status set**: `PRODUCTION_READY_STATUSES` in `transition_service.py`
- **Frontend API client**: `apiFetch` in `src/lib/api-client.ts`
- **Frontend proxy pattern**: Next.js route handlers in `src/app/api/`

## Forward Intelligence

### Fragility
- **Status value drift**: The color classification depends on exact Russian status strings. If a new ProjectItem status is added, readiness logic must be updated. Mitigation: the classification is explicit and tested — a new status would cause test failures.
- **Frontend status mapping**: The frontend uses English status keys (`new`, `processing`, etc.) while backend uses Russian. The readiness endpoint returns project-level data, not item-level statuses, so no new mapping is needed. The readiness values (`green`, `yellow`, `red`) are intentionally English — they're UI values, not DB statuses.

### Changed assumptions since S01/S02
- None. S01 ensured stock quantities are accurate. S02 ensured ProjectItem.status is reliable (gated by transition guard). S03 only reads data these slices guarantee.

### Consistency with existing code
- The `transition_service.can_transition_to` already counts items by status and computes ready/total ratios. The readiness endpoint is a read-only version of the same logic, generalized to all projects and all statuses. This is a natural extension of S02's work.

### Watch-outs
- **Dashboard uses Prisma directly** — the `/api/stats` route bypasses FastAPI entirely. Adding readiness to the dashboard requires either: (a) a separate API call, (b) rewriting stats to use FastAPI, or (c) duplicating readiness logic in the stats route. Option (a) is recommended for minimal blast radius.
- **Kanban fetches projects via `/api/projects` proxy** — items are NOT included in the list response by default (need to check if the proxy includes them). The readiness endpoint provides readiness without needing item-level data, so it's more efficient.
- **Performance**: For N projects, the naive approach does N+1 queries (1 for projects, N for item counts). For <100 projects this is negligible. If performance becomes an issue, a single `GROUP BY project_id, status` raw query can replace the loop.

## Task Decomposition (for planner)

### T01: Backend readiness endpoint + schema + tests
- **Schema**: `ProjectReadinessResponse` in `backend/schemas.py`
- **Constant export**: Make `PRODUCTION_READY_STATUSES` public in `transition_service.py`
- **Endpoint**: `GET /api/projects/readiness` in `backend/routers/projects.py`
- **Tests**: `backend/tests/test_readiness.py` — 10-12 tests
- **Estimated effort**: Medium (new endpoint but simple logic, well-established patterns)
- **Independent of**: T02, T03

### T02: Frontend API layer + proxy
- **API method**: `fetchProjectReadiness()` in `src/lib/api/projects.ts`
- **Next.js proxy**: `src/app/api/projects/readiness/route.ts`
- **Types**: Add `ProjectReadinessResponse` to `src/types/fastapi.ts`
- **Estimated effort**: Small (established proxy pattern)
- **Depends on**: T01 (endpoint must exist)

### T03: Frontend UI integration
- **Kanban**: Add readiness dot to `DraggableProjectCard` in `projects.tsx`
- **Dashboard**: Add readiness dot to recent project cards in `dashboard.tsx`
- **Tooltip/breakdown**: Optional click-to-expand showing item counts per status
- **Estimated effort**: Medium (UI work in two components)
- **Depends on**: T02 (API layer ready)
- **Independent of**: T01 (can develop against mock data, then wire to real endpoint)

### First proof: T01
The backend endpoint is the highest-risk item. Once it's tested and working, T02 and T03 are straightforward wiring. Build and verify T01 first.

## Sources

- `backend/services/transition_service.py` — existing readiness constant and status-counting pattern (lines 17-58)
- `backend/routers/projects.py` — endpoint auth/RBAC pattern to follow
- `backend/schemas.py` — Pydantic v2 `BaseSchema` pattern (lines 16-18, 98-119)
- `backend/rbac.py` — `require_role`, `apply_ownership_filter` patterns
- `src/components/app/projects.tsx` — `DraggableProjectCard` component (lines 179-293)
- `src/components/app/dashboard.tsx` — recent projects section (lines 1941-1986)
- `src/app/api/projects/route.ts` — Next.js proxy pattern for FastAPI
- `src/lib/api/projects.ts` — typed API method pattern
- `src/types/fastapi.ts` — TypeScript interface pattern
- MEM106: Production gate condition — ready = На складе or Оплачено
- MEM107: Status value unification — backend Enum is single source of truth
- MEM092: FastAPI as single data source for frontend
