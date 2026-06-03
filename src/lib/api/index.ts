/**
 * Unified API exports for ZakupPro FastAPI backend
 *
 * Central exports for all typed API methods.
 * Import from here for access to all endpoints.
 */

// =============================================================================
// API Client
// =============================================================================

export { apiClient, apiFetch, get, post, put, patch, del, throwErrorOnError, isSuccess, isFailure } from '@/lib/api-client';
export type { ApiResult, RequestOptions } from '@/lib/api-client';

// =============================================================================
// Projects API
// =============================================================================

export { projectsApi } from '@/lib/api/projects';
export type {
  ProjectResponse,
  ProjectCreate,
  ProjectUpdate,
  ProjectItemResponse,
  ProjectItemCreate,
  ProjectItemUpdate,
} from '@/types/fastapi';

// =============================================================================
// Suppliers API
// =============================================================================

export { suppliersApi } from '@/lib/api/suppliers';
export type {
  SupplierResponse,
  SupplierCreate,
  SupplierUpdate,
} from '@/types/fastapi';

// =============================================================================
// Stock Items (Warehouse) API
// =============================================================================

export { stockItemsApi } from '@/lib/api/stock-items';
export type {
  StockItemResponse,
  StockItemCreate,
  StockItemUpdate,
} from '@/types/fastapi';

// =============================================================================
// Invoices API
// =============================================================================

export { invoicesApi } from '@/lib/api/invoices';
export type {
  InvoiceResponse,
  InvoiceCreate,
  InvoiceUpdate,
  PaymentResponse,
  PaymentCreate,
  PaymentUpdate,
} from '@/types/fastapi';

// =============================================================================
// Analytics API
// =============================================================================

export { analyticsApi } from '@/lib/api/analytics';
export type {
  DashboardMetricsResponse,
  PaymentDynamicsResponse,
  PaymentDynamicsPoint,
  UploadBankStatementResponse,
  PaymentDynamicsQueryParams,
} from '@/types/fastapi';

// =============================================================================
// Common Types
// =============================================================================

export type {
  ApiError,
  PaginatedResponse,
  ListQueryParams,
  DateRangeQueryParams,
  DateTime,
} from '@/types/fastapi';
