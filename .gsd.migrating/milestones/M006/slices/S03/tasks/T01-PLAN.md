---
estimated_steps: 7
estimated_files: 4
skills_used: []
---

# T01: Backend readiness endpoint with schema, constant export, and tests

Why: The backend readiness endpoint is the data foundation for the entire slice. It computes per-project readiness from ProjectItem.status counts using the same PRODUCTION_READY_STATUSES set that S02's transition guard uses.

Do:
1. In backend/services/transition_service.py line 18: rename _PRODUCTION_READY_STATUSES → PRODUCTION_READY_STATUSES (remove leading underscore). Update the reference on line 50. This is a pure rename — no logic change, all existing tests must still pass.
2. In backend/schemas.py after line 119 (after ProjectResponse): add ProjectReadinessResponse(BaseSchema) with fields: project_id: int, project_name: str, readiness: str (green/yellow/red), ready_count: int, total_count: int, breakdown: dict[str, int].
3. In backend/routers/projects.py after line 56 (after list_projects): add GET /api/projects/readiness endpoint. Auth: Depends(require_role([Role.OWNER, Role.MANAGER])). Query all projects with apply_ownership_filter. For each project, aggregate ProjectItem.status counts via GROUP BY. Compute readiness: green if all items in PRODUCTION_READY_STATUSES, yellow if no 'К закупке' items but some not-yet-ready, red if any 'К закупке'. Empty project → green. Import PRODUCTION_READY_STATUSES from backend.services.transition_service.
4. Create backend/tests/test_readiness.py with 12 tests: green_all_ready, green_empty_project, yellow_in_transit, red_has_k_zakupke, mixed_status_breakdown_accuracy, single_item_red, rbac_401_no_token, rbac_403_warehouse, rbac_200_owner, rbac_200_manager, ownership_filter_manager_sees_only_own, nonexistent_project_handling.

Done when: all 12 readiness tests pass, plus existing stock_service (36) and transition_service (16) tests pass with no regressions.

## Inputs

- `backend/services/transition_service.py`
- `backend/schemas.py`
- `backend/routers/projects.py`
- `backend/rbac.py`
- `backend/models.py`
- `backend/auth.py`
- `backend/database.py`

## Expected Output

- `backend/services/transition_service.py`
- `backend/schemas.py`
- `backend/routers/projects.py`
- `backend/tests/test_readiness.py`

## Verification

cd D:/CLAUDE/Project/zakuppro/zakuppro && python -m pytest backend/tests/test_readiness.py backend/tests/test_stock_service.py backend/tests/test_transition_service.py -v --tb=short

## Observability Impact

Structured INFO log on readiness endpoint: project count and total duration. Endpoint returns HTTP 500 on DB errors, 401/403 on auth failures — same patterns as list_projects.
