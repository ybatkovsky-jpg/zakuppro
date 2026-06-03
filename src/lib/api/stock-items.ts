/**
 * Stock Items (Warehouse) API - Typed methods for stock item endpoints
 */

import { apiClient, type ApiResult } from '@/lib/api-client';
import type {
  StockItemResponse,
  StockItemCreate,
  StockItemUpdate,
  ListQueryParams,
} from '@/types/fastapi';

const BASE_PATH = '/api/stock-items';

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * List all stock items with optional filters
 */
export async function listStockItems(
  params?: ListQueryParams
): Promise<ApiResult<StockItemResponse[]>> {
  return apiClient.get<StockItemResponse[]>(BASE_PATH, params);
}

/**
 * Get a single stock item by ID
 */
export async function getStockItem(
  id: number
): Promise<ApiResult<StockItemResponse>> {
  return apiClient.get<StockItemResponse>(`${BASE_PATH}/${id}`);
}

/**
 * Create a new stock item
 */
export async function createStockItem(
  data: StockItemCreate
): Promise<ApiResult<StockItemResponse>> {
  return apiClient.post<StockItemResponse>(BASE_PATH, data);
}

/**
 * Update an existing stock item
 */
export async function updateStockItem(
  id: number,
  data: StockItemUpdate
): Promise<ApiResult<StockItemResponse>> {
  return apiClient.put<StockItemResponse>(`${BASE_PATH}/${id}`, data);
}

/**
 * Delete a stock item
 */
export async function deleteStockItem(
  id: number
): Promise<ApiResult<null>> {
  return apiClient.delete<null>(`${BASE_PATH}/${id}`);
}

// =============================================================================
// Export grouped object
// =============================================================================

export const stockItemsApi = {
  list: listStockItems,
  get: getStockItem,
  create: createStockItem,
  update: updateStockItem,
  delete: deleteStockItem,
};

export default stockItemsApi;
