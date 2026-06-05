---
id: T01
parent: S04
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T05:14:25.560Z
blocker_discovered: false
---

# T01: Created backend API endpoints (list, detail, retry) for FailedTask DLQ records with OWNER-only RBAC and comprehensive test coverage.

**Created backend API endpoints (list, detail, retry) for FailedTask DLQ records with OWNER-only RBAC and comprehensive test coverage.**

## What Happened

Implemented the full task plan: (1) Added FailedTaskResponse and FailedTaskListResponse schemas to backend/schemas.py and backend/schemas/__init__.py re-exports, following the existing paginated list pattern (items/total/skip/limit). (2) Created backend/routers/admin_failed_tasks.py with three endpoints: GET /api/admin/failed-tasks/ (paginated list with optional task_name filter), GET /{id} (detail by PK with 404), POST /{id}/retry (validates task_name in Celery registry, deserializes context JSON, calls apply_async, deletes FailedTask on success; returns 400 for unknown task, 422 for malformed JSON). All endpoints are gated with Depends(require_role([Role.OWNER])). (3) Registered the router in backend/main.py. (4) Created backend/tests/test_api/test_admin_failed_tasks.py with 23 tests covering: empty list, list with records, pagination skip/limit, task_name filter, detail 200/404, retry success with mocked Celery, retry empty context, retry unknown task→400, retry malformed context→422, retry 404, and full RBAC matrix (owner 200, manager 403, warehouse 403, unauthenticated 401). All 23 tests pass.

## Verification

python -m pytest backend/tests/test_api/test_admin_failed_tasks.py -v passes all 23 tests.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -m pytest backend/tests/test_api/test_admin_failed_tasks.py -v` | 0 | 23 passed | 65150ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
