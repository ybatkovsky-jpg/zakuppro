/**
 * Projects API - Typed methods for project endpoints
 */

import { apiClient, type ApiResult } from '@/lib/api-client';
import type {
  ProjectResponse,
  ProjectReadinessResponse,
  ProjectCreate,
  ProjectUpdate,
  ListQueryParams,
} from '@/types/fastapi';

const BASE_PATH = '/api/projects';

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * List all projects with optional filters
 */
export async function listProjects(
  params?: ListQueryParams
): Promise<ApiResult<ProjectResponse[]>> {
  return apiClient.get<ProjectResponse[]>(BASE_PATH, params);
}

/**
 * Get a single project by ID
 */
export async function getProject(
  id: number
): Promise<ApiResult<ProjectResponse>> {
  return apiClient.get<ProjectResponse>(`${BASE_PATH}/${id}`);
}

/**
 * Create a new project
 */
export async function createProject(
  data: ProjectCreate
): Promise<ApiResult<ProjectResponse>> {
  return apiClient.post<ProjectResponse>(BASE_PATH, data);
}

/**
 * Update an existing project
 */
export async function updateProject(
  id: number,
  data: ProjectUpdate
): Promise<ApiResult<ProjectResponse>> {
  return apiClient.put<ProjectResponse>(`${BASE_PATH}/${id}`, data);
}

/**
 * Delete a project
 */
export async function deleteProject(
  id: number
): Promise<ApiResult<null>> {
  return apiClient.delete<null>(`${BASE_PATH}/${id}`);
}

// =============================================================================
// Readiness
// =============================================================================

/**
 * Fetch readiness status for all projects
 */
export async function fetchProjectReadiness(): Promise<ApiResult<ProjectReadinessResponse[]>> {
  return apiClient.get<ProjectReadinessResponse[]>(`${BASE_PATH}/readiness`);
}

// =============================================================================
// Export grouped object
// =============================================================================

export const projectsApi = {
  list: listProjects,
  get: getProject,
  create: createProject,
  update: updateProject,
  delete: deleteProject,
  readiness: fetchProjectReadiness,
};

export default projectsApi;
