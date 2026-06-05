---
estimated_steps: 3
estimated_files: 1
skills_used: []
---

# T03: Build FailedTasks admin component with table, detail drawer, and retry button

Why: The owner needs a visual interface to browse, inspect, and retry failed Celery tasks. A table enables scanning, a detail drawer shows full error context, and the retry button closes the recovery loop.

Do: Create src/components/app/failed-tasks.tsx as a 'use client' component. Use shadcn/ui Table for the list with columns: ID (mono), Task Name (truncated), Error Type (Badge variant="outline"), Created At (formatted), Actions (Eye button → open detail, RefreshCw button → retry). Fetch list with @tanstack/react-query useQuery({ queryKey: ['failed-tasks', params], queryFn: () => failedTasksApi.list(params) }). Use Sheet (drawer, side="right") for detail view: show task_name, error_type badge, task_id (mono), file_path, chat_id, created_at as labeled fields; error_message in a scrollable pre block (max-h-64 overflow-y-auto); context JSON in a formatted pre block. Use AlertDialog for retry confirmation ("Перезапустить задачу?" / "Отмена" / "Перезапустить"). Retry button uses useMutation with onSuccess → invalidate query + close drawer. Handle states: loading (Skeleton rows via Skeleton component), empty ("Нет неудачных задач" with CheckCircle icon), error (AlertTriangle with error.message). Use useAuth() to disable retry button if role !== 'owner' (defense in depth).

Done when: npx tsc --noEmit reports zero errors; component renders without runtime errors when temporarily wired into page.tsx for visual check.

## Inputs

- `src/types/fastapi.ts`
- `src/lib/api/failed-tasks.ts`
- `src/lib/api-client.ts`
- `src/components/providers/auth-provider.tsx`
- `src/components/app/app-sidebar.tsx`
- `src/app/page.tsx`

## Expected Output

- `src/components/app/failed-tasks.tsx`

## Verification

npx tsc --noEmit
