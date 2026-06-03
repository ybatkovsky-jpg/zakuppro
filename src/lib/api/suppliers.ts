/**
 * Suppliers API - Typed methods for supplier endpoints
 */

import { apiClient, type ApiResult } from '@/lib/api-client';
import type {
  SupplierResponse,
  SupplierCreate,
  SupplierUpdate,
  ListQueryParams,
} from '@/types/fastapi';

const BASE_PATH = '/api/suppliers';

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * List all suppliers with optional filters
 */
export async function listSuppliers(
  params?: ListQueryParams
): Promise<ApiResult<SupplierResponse[]>> {
  return apiClient.get<SupplierResponse[]>(BASE_PATH, params);
}

/**
 * Get a single supplier by ID
 */
export async function getSupplier(
  id: number
): Promise<ApiResult<SupplierResponse>> {
  return apiClient.get<SupplierResponse>(`${BASE_PATH}/${id}`);
}

/**
 * Create a new supplier
 */
export async function createSupplier(
  data: SupplierCreate
): Promise<ApiResult<SupplierResponse>> {
  return apiClient.post<SupplierResponse>(BASE_PATH, data);
}

/**
 * Update an existing supplier
 */
export async function updateSupplier(
  id: number,
  data: SupplierUpdate
): Promise<ApiResult<SupplierResponse>> {
  return apiClient.put<SupplierResponse>(`${BASE_PATH}/${id}`, data);
}

/**
 * Delete a supplier
 */
export async function deleteSupplier(
  id: number
): Promise<ApiResult<null>> {
  return apiClient.delete<null>(`${BASE_PATH}/${id}`);
}

// =============================================================================
// Export grouped object
// =============================================================================

export const suppliersApi = {
  list: listSuppliers,
  get: getSupplier,
  create: createSupplier,
  update: updateSupplier,
  delete: deleteSupplier,
};

export default suppliersApi;
