---
estimated_steps: 3
estimated_files: 3
skills_used: []
---

# T02: Add frontend TypeScript types and API client module for failed-tasks

Why: The frontend component needs typed API bindings matching the backend endpoint shapes. Without these, the component would use raw fetch and lack type safety and consistency with the rest of the app.

Do: Add FailedTaskResponse and FailedTaskListResponse interfaces to src/types/fastapi.ts (pattern: FailedTaskResponse has id, task_id, task_name, error_message, error_type, file_path, chat_id, context, created_at; FailedTaskListResponse wraps items + total + skip + limit). Create src/lib/api/failed-tasks.ts with BASE_PATH="/api/admin/failed-tasks", exported async functions: listFailedTasks(params?: {skip?, limit?, task_name?}), getFailedTask(id: number), retryFailedTask(id: number). Use apiClient.get/post helpers. Export grouped failedTasksApi object following src/lib/api/invoices.ts pattern exactly. Add barrel export to src/lib/api/index.ts: export { failedTasksApi } and re-export types.

Done when: npx tsc --noEmit reports no new errors attributable to the added files.

## Inputs

- `src/types/fastapi.ts`
- `src/lib/api-client.ts`
- `src/lib/api/invoices.ts`
- `src/lib/api/index.ts`

## Expected Output

- `src/lib/api/failed-tasks.ts`

## Verification

npx tsc --noEmit
