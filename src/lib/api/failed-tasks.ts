/**
 * Failed Tasks (DLQ) API - Typed methods for failed-task endpoints
 */

import { apiClient, type ApiResult } from '@/lib/api-client';
import type {
  FailedTaskResponse,
  FailedTaskListResponse,
} from '@/types/fastapi';

const BASE_PATH = '/api/admin/failed-tasks';

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * List all failed tasks with optional pagination and filtering
 */
export async function listFailedTasks(
  params?: { skip?: number; limit?: number; task_name?: string }
): Promise<ApiResult<FailedTaskListResponse>> {
  return apiClient.get<FailedTaskListResponse>(BASE_PATH, params);
}

/**
 * Get a single failed task by ID with full detail
 */
export async function getFailedTask(
  id: number
): Promise<ApiResult<FailedTaskResponse>> {
  return apiClient.get<FailedTaskResponse>(`${BASE_PATH}/${id}`);
}

/**
 * Retry a failed task by re-dispatching the Celery task
 */
export async function retryFailedTask(
  id: number
): Promise<ApiResult<FailedTaskResponse>> {
  return apiClient.post<FailedTaskResponse>(`${BASE_PATH}/${id}/retry`);
}

// =============================================================================
// Export grouped object
// =============================================================================

export const failedTasksApi = {
  list: listFailedTasks,
  get: getFailedTask,
  retry: retryFailedTask,
};

export default failedTasksApi;
