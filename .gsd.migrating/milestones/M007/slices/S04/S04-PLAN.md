# S04: DLQ Admin UI

**Goal:** Provide /admin/failed-tasks page with paginated table of failed Celery tasks, detail drawer with full error traceback and context JSON, retry action that re-enqueues the task, and RBAC gating restricted to owner role.
**Demo:** Страница /admin/failed-tasks с таблицей неудачных задач, кнопкой Retry и деталями ошибок

## Must-Haves

- Owner navigates via sidebar to Failed Tasks, sees paginated table of DLQ entries. Clicking a row opens detail drawer with full error_message and context JSON. Clicking Retry re-dispatches the task to Celery and removes the entry from the list. Non-owner roles get neither sidebar entry nor API access (403).

## Proof Level

- This slice proves: integration

## Integration Closure

New router `admin_failed_tasks` registered in main.py with prefix `/api/admin/failed-tasks`. New component `failed-tasks.tsx` rendered in page.tsx under the `'failed-tasks'` view case. Sidebar nav item gated to owner role. API client module exported from barrel index. Full pipeline: sidebar click → view switch → component mount → TanStack Query → API call → RBAC check → DB query → response → table render.

## Verification

- Retry attempts produce Celery task events visible in worker logs (task-received, task-succeeded, task-failed). FailedTask table serves as inspection surface for undiagnosed failures — each row retains task_id, error_message, error_type, file_path, chat_id, and context JSON. Retry success removes the row (idempotent delete); retry failure preserves it with original error_message intact for diagnosis.

## Tasks

- [x] **T01: Create backend API endpoints for FailedTask list, detail, and retry** `est:45m`
  Why: No API exists for viewing or retrying DLQ records. The owner needs programmatic access to inspect and re-dispatch failed Celery tasks from the FailedTask table.
  - Files: `backend/schemas.py`, `backend/routers/admin_failed_tasks.py`, `backend/main.py`, `backend/tests/test_api/test_admin_failed_tasks.py`
  - Verify: python -m pytest backend/tests/test_api/test_admin_failed_tasks.py -v

- [x] **T02: Add frontend TypeScript types and API client module for failed-tasks** `est:20m`
  Why: The frontend component needs typed API bindings matching the backend endpoint shapes. Without these, the component would use raw fetch and lack type safety and consistency with the rest of the app.
  - Files: `src/types/fastapi.ts`, `src/lib/api/failed-tasks.ts`, `src/lib/api/index.ts`
  - Verify: npx tsc --noEmit

- [x] **T03: Build FailedTasks admin component with table, detail drawer, and retry button** `est:45m`
  Why: The owner needs a visual interface to browse, inspect, and retry failed Celery tasks. A table enables scanning, a detail drawer shows full error context, and the retry button closes the recovery loop.
  - Files: `src/components/app/failed-tasks.tsx`
  - Verify: npx tsc --noEmit

- [x] **T04: Wire failed-tasks view into app navigation (store, sidebar, page)** `est:15m`
  Why: The component alone is invisible. It needs route entries in the Zustand store, sidebar navigation, and page rendering logic to become reachable from the app shell.
  - Files: `src/store/app-store.ts`, `src/components/app/app-sidebar.tsx`, `src/app/page.tsx`
  - Verify: npx tsc --noEmit

## Files Likely Touched

- backend/schemas.py
- backend/routers/admin_failed_tasks.py
- backend/main.py
- backend/tests/test_api/test_admin_failed_tasks.py
- src/types/fastapi.ts
- src/lib/api/failed-tasks.ts
- src/lib/api/index.ts
- src/components/app/failed-tasks.tsx
- src/store/app-store.ts
- src/components/app/app-sidebar.tsx
- src/app/page.tsx
