---
estimated_steps: 8
estimated_files: 4
skills_used: []
---

# T01: Create backend API endpoints for FailedTask list, detail, and retry

Why: No API exists for viewing or retrying DLQ records. The owner needs programmatic access to inspect and re-dispatch failed Celery tasks from the FailedTask table.

Do: Add FailedTaskResponse and FailedTaskListResponse Pydantic schemas to backend/schemas.py (inherit BaseSchema, ConfigDict(from_attributes=True), wrapper with items/total/skip/limit for pagination). Create backend/routers/admin_failed_tasks.py with APIRouter(prefix="/api/admin/failed-tasks", tags=["admin"]). Three endpoints:
1. GET / — paginated list (skip/limit via Query, optional task_name filter), returns FailedTaskListResponse
2. GET /{id} — detail by PK, returns FailedTaskResponse, 404 if missing
3. POST /{id}/retry — deserialize context JSON, resolve task by task_name via celery_app.app.tasks, call apply_async(kwargs=context_dict), delete FailedTask on success, return {"status": "retried"}. If task_name not in app.tasks return 400. If context is malformed JSON return 422.

Gate all endpoints with Depends(require_role([Role.OWNER])). Register in main.py with app.include_router(admin_failed_tasks.router).

Create backend/tests/test_api/test_admin_failed_tasks.py with pytest tests (TestClient pattern from conftest.py): list empty, list with records, pagination skip/limit, filter by task_name, detail 200, detail 404, retry success (mock celery_app.app.tasks), retry with unknown task_name → 400, retry with malformed context JSON → 422, 403 for manager role, 403 for warehouse role, 401 for unauthenticated.

Done when: python -m pytest backend/tests/test_api/test_admin_failed_tasks.py -v passes all tests.

## Inputs

- `backend/models.py`
- `backend/schemas.py`
- `backend/rbac.py`
- `backend/celery_app.py`
- `backend/main.py`
- `backend/tasks.py`
- `backend/database.py`
- `backend/tests/conftest.py`

## Expected Output

- `backend/routers/admin_failed_tasks.py`

## Verification

python -m pytest backend/tests/test_api/test_admin_failed_tasks.py -v

## Observability Impact

Adds structured HTTP logs for DLQ list/detail/retry operations. Retry endpoint produces Celery task events (task-received → task-succeeded/task-failed) visible in worker logs. FailedTask rows retain original error_message + context for post-mortem diagnosis even after failed retry.
