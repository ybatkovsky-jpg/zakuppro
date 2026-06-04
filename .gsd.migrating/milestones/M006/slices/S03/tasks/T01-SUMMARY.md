---
id: T01
parent: S03
milestone: M006
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-04T10:31:23.928Z
blocker_discovered: false
---

# T01: Added GET /api/projects/readiness endpoint returning per-project green/yellow/red readiness with item counts by procurement stage, built on PRODUCTION_READY_STATUSES from transition_service

**Added GET /api/projects/readiness endpoint returning per-project green/yellow/red readiness with item counts by procurement stage, built on PRODUCTION_READY_STATUSES from transition_service**

## What Happened

Renamed _PRODUCTION_READY_STATUSES → PRODUCTION_READY_STATUSES in transition_service.py (line 18, with all 3 references updated). Added ProjectReadinessResponse schema to schemas.py with fields: project_id, project_name, readiness (green/yellow/red), ready_count, total_count, breakdown (dict[str,int]). Placed readiness endpoint at GET /api/projects/readiness BEFORE the /{project_id} route to avoid path conflict. Endpoint uses DEPENDS(require_role([Owner,Manager])), applies ownership filter, batches status counts in a single GROUP BY query, then computes readiness per project: green if all items in PRODUCTION_READY_STATUSES (or empty), yellow if no 'К закупке' but some not-yet-ready, red if any 'К закупке'. Structured INFO log records project count and duration. Exported ProjectReadinessResponse from schemas/__init__.py. Created test_readiness.py with 12 tests covering: green_all_ready, green_empty_project, yellow_in_transit, red_has_k_zakupke, mixed_status_breakdown_accuracy, single_item_red, rbac_401_no_token, rbac_403_warehouse, rbac_200_owner, rbac_200_manager, ownership_filter_manager_sees_only_own, and nonexistent_project_handling (empty DB). All 64 tests pass across readiness (12), stock_service (36), and transition_service (16).

## Verification

Ran python -m pytest backend/tests/test_readiness.py backend/tests/test_stock_service.py backend/tests/test_transition_service.py -v --tb=short. All 64 tests passed with zero failures. Readiness correctness verified for all three readiness levels (green/yellow/red), breakdown dict accuracy confirmed per-status, RBAC enforcement verified (401 no token, 403 warehouse, 200 owner/manager), ownership filtering confirmed (manager sees only own projects), empty-DB edge case returns 200 with []. No regressions in stock_service (36 tests) or transition_service (16 tests).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -m pytest backend/tests/test_readiness.py backend/tests/test_stock_service.py backend/tests/test_transition_service.py -v --tb=short` | 0 | pass | 4440ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
