---
id: S02
parent: M006
milestone: M006
provides:
  - transition_service.py with can_transition_to guard
  - HTTP 422 rejection on blocked transitions with item-level breakdown
  - 16 unit+integration tests verifying blocking/allowing/edge cases
  - Structured INFO logging on both blocked and allowed transitions
requires:
  []
affects:
  - backend/routers/projects.py (update_project)
  - backend/services/transition_service.py
key_files:
  - backend/services/transition_service.py
  - backend/routers/projects.py
  - backend/tests/test_transition_service.py
key_decisions: []
patterns_established:
  - (none)
observability_surfaces:
  - Structured INFO logs on blocked transitions with project_id, ready/non-ready counts
  - HTTP 422 response body with item-level status breakdown
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-06-04T10:14:16.271Z
blocker_discovered: false
---

# S02: Kanban Guardrails

**Built transition guard blocking project status change to В производстве when ProjectItems are not all На складе or Оплачено, wired into update_project with HTTP 422 rejection, and verified with 16 tests.**

## What Happened

The slice delivered a business-rule enforcement layer for Kanban transitions. T01 created `backend/services/transition_service.py` with `can_transition_to(project, target_status, db) → (bool, reason)`, following the same service-layer pattern as stock_service.py. The guard checks all ProjectItems for a project: for target "В производстве", it verifies every item has status "На складе" or "Оплачено". When blocked, it returns a descriptive reason with item counts per non-ready status and emits structured INFO logs. Non-production transitions pass through without blocking.

T02 wired the guard into `update_project` in `backend/routers/projects.py`. The can_transition_to check runs before ProjectStatusHistory recording and stock write-off, ensuring no side effects on blocked transitions. Blocked transitions return HTTP 422 with the item-level breakdown reason. Valid transitions proceed with the existing flow unchanged — history is recorded and write_off_for_production fires on successful transition to В производстве.

T03 wrote comprehensive tests: 11 unit tests for can_transition_to covering blocks for К закупке, Запрошено, Счет получен, mixed statuses, all-non-ready; allows for all-На складе, all-Оплачено, mixed ready, empty project, non-production target. 5 integration tests via FastAPI TestClient covering 422 with item breakdown, 422 with multiple non-ready statuses, 200 with all items ready, 200 for non-production transitions, and history recording verification. Three test-environment issues were discovered and fixed: auth token key mismatch ("sub" vs "user_id"), missing owner_id in fixtures, and stock test item status preventing write-off guard from passing. All 16 transition tests and all 36 stock tests pass (52 total).

## Verification

Fresh verification executed via gsd_exec:
1. `python -m pytest tests/test_transition_service.py -v --tb=short` → 16 passed in 2.83s (exit code 0)
2. `python -m pytest tests/test_stock_service.py tests/test_transition_service.py -v --tb=short` → 52 passed in 3.84s (exit code 0)
3. Import checks: transition_service can_transition_to and update_project imports verified in T01/T02
4. No regressions in stock_service or transition_service test suites

## Requirements Advanced

- R012 — can_transition_to guard now enforces the business rule: transition to В производстве is blocked when any ProjectItem is not На складе or Оплачено. Wired into update_project endpoint returning HTTP 422 with descriptive reason including item counts.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

Full test suite has 58 pre-existing failures in analytics, project API, bank statement, and schema tests — all unrelated to the transition guard and predating S02.

## Follow-ups

S03 readiness matrix depends on this guard to ensure ProjectItem.status reliably reflects true procurement stage.

## Files Created/Modified

None.
