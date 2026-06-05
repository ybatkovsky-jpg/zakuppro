---
id: T02
parent: S04
milestone: M007
key_files:
  - src/types/fastapi.ts
  - src/lib/api/failed-tasks.ts
  - src/lib/api/index.ts
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T05:09:17.583Z
blocker_discovered: false
---

# T02: Added FailedTask TypeScript interfaces to fastapi.ts, created failed-tasks.ts API client module following invoices.ts pattern, and updated barrel exports in api/index.ts.

**Added FailedTask TypeScript interfaces to fastapi.ts, created failed-tasks.ts API client module following invoices.ts pattern, and updated barrel exports in api/index.ts.**

## What Happened

Executed T02 according to plan. Read the existing input files (fastapi.ts, api-client.ts, invoices.ts, api/index.ts) and the backend FailedTask model (models.py:295) to ensure type accuracy. Added FailedTaskResponse (id, task_id, task_name, error_message, error_type, file_path, chat_id, context, created_at) and FailedTaskListResponse (items, total, skip, limit) interfaces to src/types/fastapi.ts in a new "FailedTask / DLQ Types" section. Created src/lib/api/failed-tasks.ts with BASE_PATH="/api/admin/failed-tasks" and three exported async functions (listFailedTasks with optional skip/limit/task_name params, getFailedTask by id, retryFailedTask by id) plus a grouped failedTasksApi object following the invoices.ts pattern. Updated src/lib/api/index.ts with barrel exports for both the failedTasksApi module and the new type interfaces. Verified with npx tsc --noEmit — no new errors attributable to the added files (only pre-existing errors unrelated to this change).

## Verification

npx tsc --noEmit reports no new errors attributable to the added files. Grep-filtered output for failed-tasks, fastapi.ts, and api/index.ts produced zero matches, confirming all new code type-checks cleanly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit 2>&1 | grep -i 'failed-task\|fastapi.ts\|api/index.ts'` | 1 | pass | 25000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/types/fastapi.ts`
- `src/lib/api/failed-tasks.ts`
- `src/lib/api/index.ts`
