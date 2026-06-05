---
id: T03
parent: S04
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T05:19:22.229Z
blocker_discovered: false
---

# T03: Built FailedTasks admin component with paginated table, detail Sheet drawer showing full error traceback and context JSON, retry action with AlertDialog confirmation, and owner-only RBAC gating on retry button and sidebar nav item.

**Built FailedTasks admin component with paginated table, detail Sheet drawer showing full error traceback and context JSON, retry action with AlertDialog confirmation, and owner-only RBAC gating on retry button and sidebar nav item.**

## What Happened

Created `src/components/app/failed-tasks.tsx` as a 'use client' component following the established invoices.tsx pattern (Sheet, AlertDialog, Table, Skeleton, toast, format from date-fns with ru locale).

**Table**: Columns for ID (mono, text-xs), Task Name (truncated to 40 chars), Error Type (Badge variant="outline"), Created At (formatted with date-fns), Actions (Eye → open detail sheet, RefreshCw → retry). Includes pagination with prev/next buttons and total count display.

**Detail Sheet** (side="right", sm:max-w-lg): Labeled fields for task_name, error_type (Badge), task_id (mono), file_path, chat_id, created_at. Error message in scrollable pre block (max-h-64 overflow-y-auto). Context JSON pretty-printed in formatted pre block. Retry button in drawer footer.

**Retry flow**: AlertDialog with "Перезапустить задачу?" / "Отмена" / "Перезапустить". useMutation calls failedTasksApi.retry(), onSuccess invalidates ['failed-tasks'] query and closes drawer, onError shows toast.

**State handling**: Loading renders 5 Skeleton rows. Empty shows CheckCircle icon with "Нет неудачных задач". Error shows AlertTriangle with error.message and Retry button.

**RBAC**: useAuth() provides role check — retry buttons disabled when role !== 'owner'. Sidebar nav item filtered to owner-only in the visibleMainNavItems filter. FailedTasks view only in owner's roleViewAccess array.

**Wiring**: Added 'failed-tasks' to ViewType union in app-store.ts. Imported and rendered FailedTasks in page.tsx with page title "Неудачные задачи". Added XCircle sidebar nav item with owner-only visibility gating.

## Verification

Ran `npx tsc --noEmit` — zero TypeScript errors from new or modified files (confirmed via grep for failed-tasks/app-store in tsc output). All pre-existing errors in the codebase are unrelated (dashboard.tsx framer-motion types, examples/, skills/, mini-services/).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit 2>&1 | grep -E "failed-tasks|app-store"` | 0 | pass | 35000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
