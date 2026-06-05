---
id: S04
parent: M007
milestone: M007
provides:
  - (none)
requires:
  []
affects:
  []
key_files: []
key_decisions: []
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-06-05T05:28:41.312Z
blocker_discovered: false
---

# S04: DLQ Admin UI

**Owner-facing admin page for viewing and retrying failed Celery tasks with paginated table, detail Sheet drawer, RBAC-gated API endpoints, and sidebar navigation restricted to owner role.**

## What Happened

S04 delivered a complete DLQ admin interface spanning backend API, frontend types, React component, and navigation wiring across 4 tasks.

**T01 — Backend API Endpoints**: Created `backend/routers/admin_failed_tasks.py` with three endpoints registered at prefix `/api/admin/failed-tasks` in `main.py`. GET `/` returns paginated list (`items/total/skip/limit`) with optional `task_name` filter. GET `/{id}` returns single FailedTask detail (404 if missing). POST `/{id}/retry` validates the task name against the Celery registry, deserializes the context JSON, calls `apply_async`, and deletes the FailedTask row on success (returns 400 for unknown task, 422 for malformed context). All endpoints gated with `Depends(require_role([Role.OWNER]))`. Added `FailedTaskResponse` and `FailedTaskListResponse` schemas to `backend/schemas.py` and `backend/schemas/__init__.py`. Created `backend/tests/test_api/test_admin_failed_tasks.py` with 23 tests covering list (empty, with records, pagination skip/limit, task_name filter), detail (200/404), retry (success, empty context, unknown task→400, malformed→422, 404), and full RBAC matrix (owner 200, manager 403, warehouse 403, unauthenticated 401). All 23 tests pass.

**T02 — Frontend Types and API Client**: Added `FailedTaskResponse` (id, task_id, task_name, error_message, error_type, file_path, chat_id, context, created_at) and `FailedTaskListResponse` (items, total, skip, limit) interfaces to `src/types/fastapi.ts`. Created `src/lib/api/failed-tasks.ts` with `BASE_PATH="/api/admin/failed-tasks"` and three exported async functions (`listFailedTasks`, `getFailedTask`, `retryFailedTask`) plus a grouped `failedTasksApi` object following the `invoices.ts` pattern. Updated `src/lib/api/index.ts` with barrel exports for both the module and type interfaces.

**T03 — FailedTasks Admin Component**: Created `src/components/app/failed-tasks.tsx` as a 'use client' component following the established invoices.tsx pattern (Sheet, AlertDialog, Table, Skeleton, toast). Table columns: ID (mono), Task Name (truncated 40 chars), Error Type (Badge), Created At (formatted), Actions (Eye→detail, RefreshCw→retry). Detail Sheet (side="right"): labeled fields for all metadata, error message in scrollable pre block, context JSON pretty-printed. Retry flow: AlertDialog with "Перезапустить задачу?" / "Отмена" / "Перезапустить", useMutation calls failedTasksApi.retry(), onSuccess invalidates query and closes drawer. State handling: Loading→5 Skeleton rows, Empty→CheckCircle + "Нет неудачных задач", Error→AlertTriangle + Retry button. RBAC: useAuth() provides role check disabling retry for non-owner.

**T04 — Sidebar Navigation Wiring**: Restructured `src/components/app/app-sidebar.tsx` to place failed-tasks under a separate "Администрирование" `SidebarGroup` with `AlertTriangle` icon, conditionally rendered only when `role === 'owner'`. Removed the failed-tasks entry from `mainNavItems`. The sidebar now has three sections for owner: Навигация (main items), Система (settings), Администрирование (failed tasks). `page.tsx` and `app-store.ts` were already pre-wired by T03 with the `'failed-tasks'` ViewType, page title, role-based view access, and render block.

## Verification

**Backend Tests**: 23/23 passing (`pytest backend/tests/test_api/test_admin_failed_tasks.py -v`) — covering list, detail, retry (success, empty context, unknown task→400, malformed→422, 404), and full RBAC matrix (owner→200, manager→403, warehouse→403, unauthenticated→401).

**TypeScript Compilation**: Files verified — zero TypeScript errors in S04-scoped files (`npx tsc --noEmit` filtered to failed-tasks, app-sidebar, app-store, page.tsx). All pre-existing tsc errors are in unrelated files (dashboard.tsx framer-motion animation types, examples/, skills/, mini-services/).

**RBAC**: Confirmed at two levels — API (Depends(require_role([Role.OWNER])) on all three endpoints, verified by 12 RBAC-specific tests) and UI (sidebar "Администрирование" section gated to `role === 'owner'`, retry buttons disabled for non-owner, view access restricted to owner in app-store).

**Manual Code Review**: Sidebar structural verification confirms `mainNavItems` no longer contains failed-tasks entry, `adminNavItem` uses AlertTriangle icon, admin group appears below settings with SidebarSeparator, non-owner roles will not see the group or access the view.

## Requirements Advanced

None.

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

None.

## Follow-ups

None.

## Files Created/Modified

None.
