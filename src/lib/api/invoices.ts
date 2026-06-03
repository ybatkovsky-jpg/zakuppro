/**
 * Invoices API - Typed methods for invoice endpoints
 */

import { apiClient, type ApiResult } from '@/lib/api-client';
import type {
  InvoiceResponse,
  InvoiceCreate,
  InvoiceUpdate,
  PaymentResponse,
  ListQueryParams,
} from '@/types/fastapi';

const BASE_PATH = '/api/invoices';

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * List all invoices with optional filters
 */
export async function listInvoices(
  params?: ListQueryParams
): Promise<ApiResult<InvoiceResponse[]>> {
  return apiClient.get<InvoiceResponse[]>(BASE_PATH, params);
}

/**
 * Get a single invoice by ID with nested payments
 */
export async function getInvoice(
  id: number
): Promise<ApiResult<InvoiceResponse>> {
  return apiClient.get<InvoiceResponse>(`${BASE_PATH}/${id}`);
}

/**
 * Create a new invoice
 */
export async function createInvoice(
  data: InvoiceCreate
): Promise<ApiResult<InvoiceResponse>> {
  return apiClient.post<InvoiceResponse>(BASE_PATH, data);
}

/**
 * Update an existing invoice
 */
export async function updateInvoice(
  id: number,
  data: InvoiceUpdate
): Promise<ApiResult<InvoiceResponse>> {
  return apiClient.put<InvoiceResponse>(`${BASE_PATH}/${id}`, data);
}

/**
 * Delete an invoice
 */
export async function deleteInvoice(
  id: number
): Promise<ApiResult<null>> {
  return apiClient.delete<null>(`${BASE_PATH}/${id}`);
}

// =============================================================================
// Export grouped object
// =============================================================================

export const invoicesApi = {
  list: listInvoices,
  get: getInvoice,
  create: createInvoice,
  update: updateInvoice,
  delete: deleteInvoice,
};

export default invoicesApi;
