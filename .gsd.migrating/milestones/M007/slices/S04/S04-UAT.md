# S04: DLQ Admin UI — UAT

**Milestone:** M007
**Written:** 2026-06-05T05:28:41.316Z

## UAT: DLQ Admin UI

**UAT Type**: Integration

### Preconditions
- All Docker services running (`docker-compose up -d` — db, api, celery-worker, rabbitmq, frontend)
- Owner user logged in with valid JWT token (role=owner)
- At least one FailedTask record exists in the database (e.g., from a failed Celery task execution)
- Non-owner test user available (manager or warehouse role)

### Steps

1. **Sidebar Visibility (Owner)**: As owner, open the app sidebar. Verify the "Администрирование" section appears below "Система" with a SidebarSeparator. It contains "Неудачные задачи" with AlertTriangle icon.

2. **Navigate to Failed Tasks**: Click "Неудачные задачи". Verify the page renders with title "Неудачные задачи" and a paginated table showing FailedTask records (columns: ID, Task Name, Error Type, Created At, Actions).

3. **Detail Drawer**: Click the Eye icon on any row. Verify a Sheet drawer opens from the right showing: task_name, error_type (Badge), task_id (monospace), file_path, chat_id, created_at, error_message (scrollable pre block), context (formatted JSON in pre block).

4. **Retry Flow**: Click the Retry button (RefreshCw icon) in the drawer. Verify an AlertDialog appears with title "Перезапустить задачу?" and buttons "Отмена" / "Перезапустить". Click "Перезапустить". Verify the drawer closes, a success toast appears, and the row is removed from the table.

5. **RBAC — Sidebar (Non-owner)**: Log in as a manager or warehouse user. Verify the sidebar does NOT show the "Администрирование" section or "Неудачные задачи" nav item.

6. **RBAC — API (Non-owner)**: As manager/warehouse, directly call `GET /api/admin/failed-tasks/`. Verify HTTP 403 Forbidden response.

### Edge Cases

- **Empty table**: When no FailedTask records exist, verify the page shows "Нет неудачных задач" with a CheckCircle icon.
- **Retry unknown task**: If a FailedTask references a task_name not in the Celery registry, retry returns HTTP 400 with appropriate error message.
- **Retry malformed context**: If context JSON is corrupt, retry returns HTTP 422.
- **Loading state**: While data is fetching, 5 Skeleton rows are displayed.
- **Network error**: If the API call fails, an error state with AlertTriangle and Retry button is shown.
- **Unauthenticated access**: Calling the API without a token returns HTTP 401.

### Not Proven By This UAT
- Actual Celery task re-execution end-to-end (retry mechanism tested with mocked Celery tasks)
- Frontend rendering verified via TypeScript compilation only — no browser-based visual testing
- Performance under high FailedTask volume (>1000 records) — standard limit/skip pagination applied
- Cross-browser compatibility
- Concurrent retry requests on the same FailedTask entry
