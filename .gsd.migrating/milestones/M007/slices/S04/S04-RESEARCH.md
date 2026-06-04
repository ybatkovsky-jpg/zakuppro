# S04 Research: DLQ Admin UI

## Summary
Build an admin UI page at `/admin/failed-tasks` for viewing, inspecting, and retrying failed Celery tasks from the DLQ (Dead Letter Queue). The backend needs CRUD endpoints for FailedTask records (list with pagination, get by ID, retry action), RBAC-guarded to owner role. The frontend needs a new `failed-tasks` view in the app store, a sidebar nav entry, and a component with a table, detail drawer, and retry button. The FailedTask model and Alembic migration already exist; no schema changes are needed.

## Requirements Coverage
- **R017** (DLQ UI/админка для просмотра и перезапуска неудачных задач с деталями ошибок): Active. Needs:
  - Backend: `GET /api/admin/failed-tasks` (paginated list), `GET /api/admin/failed-tasks/{id}` (detail), `POST /api/admin/failed-tasks/{id}/retry` (re-dispatch the task)
  - Frontend: new `failed-tasks` view with table, detail drawer, retry button, RBAC-gated to owner role

## Implementation Landscape

### Files to Touch

**Backend (new files marked NEW):**
- `backend/schemas.py` -- Add `FailedTaskResponse` and `FailedTaskListResponse` Pydantic schemas
- `backend/routers/admin_failed_tasks.py` (NEW) -- FastAPI router with list/detail/retry endpoints
- `backend/main.py` -- Register the new router with `app.include_router(admin_failed_tasks.router)`
- `backend/rbac.py` -- `FailedTask` is already in `get_readable_models` for owner role; no changes needed here unless retry also needs write access
- `backend/tasks.py` -- The retry endpoint needs to re-queue a failed task; may need a helper or direct Celery API call. (Minimal change -- could just call `app.tasks[task_name].apply_async(args, kwargs)` from stored context)

**Frontend (new files marked NEW):**
- `src/types/fastapi.ts` -- Add `FailedTaskResponse` and `FailedTaskListResponse` TypeScript interfaces
- `src/lib/api/failed-tasks.ts` (NEW) -- Typed API methods for the failed-tasks endpoints (following the pattern in `src/lib/api/invoices.ts`)
- `src/lib/api/index.ts` -- Export the new `failedTasksApi` module
- `src/components/app/failed-tasks.tsx` (NEW) -- Main component: table with columns (task name, error type, created at, actions), detail drawer showing full error_message + context JSON, Retry button with confirmation
- `src/store/app-store.ts` -- Add `'failed-tasks'` to the `ViewType` union type
- `src/components/app/app-sidebar.tsx` -- Add a nav item for "Failed Tasks" (e.g., with `AlertTriangle` icon) under a new "Admin" section, gated to owner role
- `src/app/page.tsx` -- Import the `FailedTasks` component, add `'failed-tasks'` case in the view switch, add to `pageTitles`

### Natural Seams

1. **Backend API (router + schemas + main.py registration)**: Can be done independently -- no frontend dependency. Highest priority since frontend needs the API.
2. **Frontend types + API client module**: Depends on the API endpoint shapes being defined. Can be done in parallel with or after backend.
3. **Frontend component (table + drawer + retry)**: Depends on types and API client. Largest work unit.
4. **Navigation wiring (store + sidebar + page)**: Lightweight glue, can be done last.

### First Proof
The highest-risk item is **the retry endpoint**: reconstructing the Celery call from a stored `FailedTask` record (task_name + context). This requires testing that:
- The Celery task can be looked up by name via `app.tasks[task_name]`
- The stored context can be deserialized and passed as kwargs
- The retried task does not silently fail again

**Verify first** by writing a small test (or manual curl) that:
1. Creates a `FailedTask` record manually via the DB
2. Calls `POST /api/admin/failed-tasks/{id}/retry`
3. Confirms a new Celery task is enqueued (check Celery inspect or task log)

## Key Findings

### What Exists

**FailedTask Model** (`backend/models.py:295`):
```python
class FailedTask(Base):
    __tablename__ = "failed_tasks"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(255), unique=True, nullable=False, index=True)
    task_name = Column(String(100), nullable=False)
    error_message = Column(Text, nullable=False)
    error_type = Column(String(100), nullable=False)
    file_path = Column(String(500), nullable=True)
    chat_id = Column(Integer, nullable=True)
    context = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- Alembic migration exists at `backend/alembic/versions/add_failed_tasks_table.py`
- **No existing API endpoints** for FailedTask -- no router, no CRUD.
- Tasks in `backend/tasks.py` (5 tasks: `process_bom_to_project`, `parse_invoice`, `verify_invoice`, `parse_bank_statement`, `match_bank_transactions`) all write FailedTask records on failure with `task_name`, `error_message`, `error_type`, `file_path`, `chat_id`, and `context` (JSON).
- **RBAC**: `FailedTask` is listed in `get_readable_models` for owner role only. Owner gets full read. Manager and warehouse do NOT have access.

**Frontend Admin Structure:**
- No existing `/admin` route or layout in the frontend.
- The app uses a **single-page** SPA-like architecture with Zustand store (`useAppStore`) and view switching by `ViewType`.
- Sidebar (`app-sidebar.tsx`) has a flat list of nav items: Dashboard, Projects, Suppliers, Requests, Invoices, Warehouse, Analytics, Automation, Settings.
- Components use shadcn/ui primitives (Table, Dialog, Sheet/Drawer, Badge, Button) and TanStack Query (`@tanstack/react-query`) for data fetching.
- The API client pattern (`src/lib/api-client.ts`) is a typed fetch wrapper with JWT auth from localStorage.
- TypeScript types mirroring Pydantic schemas live in `src/types/fastapi.ts`.
- Separate API modules per resource live in `src/lib/api/` (e.g., `invoices.ts`, `projects.ts`).

### What's Missing

- **Backend**: No router/endpoints for listing, viewing, or retrying FailedTask records
- **Backend schemas**: No Pydantic schemas for FailedTask response
- **Frontend types**: No TypeScript interfaces for FailedTask
- **Frontend API module**: No `failed-tasks.ts` API client
- **Frontend component**: No `failed-tasks.tsx` component with table/drawer/retry
- **Frontend navigation**: No `failed-tasks` view in store, no sidebar entry, no page.tsx import
- **Retry mechanism**: No existing code to re-dispatch a failed Celery task from a stored record

### Constraints

- **RBAC**: Only `owner` role can access FailedTask data. The retry action should also be gated to owner. The sidebar entry should be hidden from manager/warehouse roles (or shown grayed-out). The current frontend has no RBAC gating in the sidebar -- all entries are visible to all users. May need to add role awareness or just let the backend enforce it.
- **Celery retry**: The `context` JSON field stores different schemas per task type (e.g., `{chat_id, file_path}` for BOM, `{filename, file_size, metadata}` for invoice parsing). The retry endpoint must parse and pass these correctly.
- **No pagination on existing endpoints**: Most list endpoints return all results. For DLQ which could grow large, pagination (skip/limit) is recommended for the list endpoint.
- **Error message size**: `error_message` can contain full tracebacks (potentially large). The detail view should render this as a scrollable pre-formatted block.

## Recommendation

### Backend API Design

Create a new router at `backend/routers/admin_failed_tasks.py` with prefix `/api/admin/failed-tasks`:

```
GET    /api/admin/failed-tasks          # List (paginated: ?skip=0&limit=50&task_name=)
GET    /api/admin/failed-tasks/{id}     # Detail (full error message + context)
POST   /api/admin/failed-tasks/{id}/retry  # Retry (re-dispatches the Celery task)
```

All endpoints guarded by `require_role([Role.OWNER])`.

**Retry logic**: Look up `FailedTask` by id, deserialize `context` from JSON, call `celery_app.app.tasks[task_name].apply_async(args=(), kwargs=deserialized_context)`, delete or mark the FailedTask record as retried. Optionally add a `retried_at` column or a `status` column to FailedTask (future).

### UI Layout

- **Table columns**: ID, Task Name, Error Type, Created At, Actions (View, Retry)
- **Detail drawer** (Sheet): Full error message in a `<pre>` scrollable block, context JSON formatted, metadata (file_path, chat_id, task_id)
- **Retry**: Button in the table row + in the detail drawer, with a confirmation dialog ("Are you sure you want to retry this task?")
- **Empty state**: Show "No failed tasks" with a checkmark icon
- **Loading state**: Skeleton rows while fetching

### Component Choice
Use shadcn/ui `Table` for the list, `Sheet` (drawer) for detail, `AlertDialog` for retry confirmation, `Badge` for error type, `Button` with `Loader2` spinner for retry action state.

### Sidebar Placement
Add a new "Admin" `SidebarGroup` below the settings separator with a single entry "Failed Tasks" (`AlertTriangle` icon). Consider role-gating: fetch current user role from auth, conditionally render the admin section only for owners. If simple role-gating is too complex initially, the backend RBAC still prevents unauthorized access.

## Verification
- `curl` or backend test: `GET /api/admin/failed-tasks` returns paginated list (empty initially)
- `curl` or backend test: `GET /api/admin/failed-tasks/{id}` returns full detail
- `curl` or backend test: `POST /api/admin/failed-tasks/{id}/retry` enqueues a new Celery task and returns success
- Backend test: 403 for non-owner roles on all endpoints
- Manual: Navigate to the admin page in browser, verify table renders, open detail drawer, click retry
- Manual: Verify that after retry, the task either disappears from the list or shows updated status
