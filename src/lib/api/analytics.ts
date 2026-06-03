/**
 * Analytics API - Typed methods for analytics endpoints
 */

import { apiClient, type ApiResult } from '@/lib/api-client';
import type {
  DashboardMetricsResponse,
  PaymentDynamicsResponse,
  PaymentDynamicsQueryParams,
  UploadBankStatementResponse,
} from '@/types/fastapi';

const BASE_PATH = '/api/analytics';

// =============================================================================
// Dashboard Metrics
// =============================================================================

/**
 * Get dashboard metrics for financial visibility
 * @param params - Optional date range filters (period_start, period_end)
 */
export async function getDashboardMetrics(
  params?: { period_start?: string; period_end?: string }
): Promise<ApiResult<DashboardMetricsResponse>> {
  return apiClient.get<DashboardMetricsResponse>(`${BASE_PATH}/dashboard`, params);
}

// =============================================================================
// Payment Dynamics
// =============================================================================

/**
 * Get payment dynamics time-series data for charts
 * @param params - Date range and grouping options
 */
export async function getPaymentDynamics(
  params?: PaymentDynamicsQueryParams
): Promise<ApiResult<PaymentDynamicsResponse>> {
  return apiClient.get<PaymentDynamicsResponse>(`${BASE_PATH}/payment-dynamics`, params);
}

// =============================================================================
// Export
// =============================================================================

/**
 * Export transactions to Excel file
 * @param params - Date filters and limit
 * @returns Blob with Excel file content
 */
export async function exportTransactionsExcel(
  params?: {
    date_from?: string;
    date_to?: string;
    limit?: number;
  }
): Promise<Blob> {
  const url = `${BASE_PATH}/export/transactions`;
  const queryString = params
    ? '?' + new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][]
      ).toString()
    : '';

  const response = await fetch(url + queryString);
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  return response.blob();
}

// =============================================================================
// Bank Statement Upload
// =============================================================================

/**
 * Upload a bank statement file for manual reconciliation
 * @param file - Bank statement file (1C ClientBank .txt format)
 */
export async function uploadBankStatement(
  file: File
): Promise<ApiResult<UploadBankStatementResponse>> {
  const formData = new FormData();
  formData.append('file', file);

  const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
  const FASTAPI_AUTH_TOKEN = process.env.FASTAPI_AUTH_TOKEN;

  const headers: Record<string, string> = {};
  if (FASTAPI_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${FASTAPI_AUTH_TOKEN}`;
  }

  try {
    const response = await fetch(`${FASTAPI_URL}${BASE_PATH}/upload-bank-statement`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const body = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: {
          error: body.detail || 'Upload failed',
          details: body,
        },
      };
    }

    return { data: body, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        error: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

// =============================================================================
// Export grouped object
// =============================================================================

export const analyticsApi = {
  getDashboardMetrics,
  getPaymentDynamics,
  exportTransactionsExcel,
  uploadBankStatement,
};

export default analyticsApi;
