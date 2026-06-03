/**
 * TypeScript types for ZakupPro FastAPI backend
 * Generated from Pydantic schemas in backend/schemas.py
 */

// =============================================================================
// Base Types
// =============================================================================

export type DateTime = string; // ISO 8601 datetime strings

// =============================================================================
// Project Types
// =============================================================================

export interface ProjectBase {
  name: string;
  client: string;
  status?: string; // default: "Проектирование"
  total_cost?: number | null;
}

export interface ProjectCreate extends ProjectBase {}

export interface ProjectUpdate {
  name?: string;
  client?: string;
  status?: string;
  total_cost?: number | null;
}

export interface ProjectItemResponse {
  id: number;
  name: string;
  sku: string;
  qty: number;
  status: string;
  supplier_id?: number | null;
  stock_item_id?: number | null;
  project_id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
}

export interface ProjectResponse extends ProjectBase {
  id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
  items: ProjectItemResponse[];
}

// =============================================================================
// ProjectItem Types
// =============================================================================

export interface ProjectItemBase {
  name: string;
  sku: string;
  qty: number;
  status?: string; // default: "К закупке"
  supplier_id?: number | null;
  stock_item_id?: number | null;
}

export interface ProjectItemCreate extends ProjectItemBase {
  project_id: number;
}

export interface ProjectItemUpdate {
  name?: string;
  sku?: string;
  qty?: number;
  status?: string;
  supplier_id?: number | null;
  stock_item_id?: number | null;
}

export interface ProjectItemResponse extends ProjectItemBase {
  id: number;
  project_id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
}

// =============================================================================
// Supplier Types
// =============================================================================

export interface SupplierBase {
  name: string;
  email: string;
  requisites?: string | null;
}

export interface SupplierCreate extends SupplierBase {}

export interface SupplierUpdate {
  name?: string;
  email?: string;
  requisites?: string | null;
}

export interface SupplierResponse extends SupplierBase {
  id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
}

// =============================================================================
// StockItem Types
// =============================================================================

export interface StockItemBase {
  name: string;
  sku: string;
  qty_total?: number; // default: 0
  qty_reserved?: number; // default: 0
  qty_available?: number; // default: 0
}

export interface StockItemCreate extends StockItemBase {}

export interface StockItemUpdate {
  name?: string;
  sku?: string;
  qty_total?: number;
  qty_reserved?: number;
  qty_available?: number;
}

export interface StockItemResponse extends StockItemBase {
  id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
}

// =============================================================================
// PurchaseOrder Types
// =============================================================================

export interface PurchaseOrderBase {
  status?: string; // default: "Сформирован"
}

export interface PurchaseOrderCreate extends PurchaseOrderBase {
  project_id: number;
  supplier_id: number;
}

export interface PurchaseOrderUpdate {
  status?: string;
}

export interface InvoiceResponseNested {
  id: number;
  file_url?: string | null;
  raw_text?: string | null;
  status: string;
  purchase_order_id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
}

export interface PurchaseOrderResponse extends PurchaseOrderBase {
  id: number;
  project_id: number;
  supplier_id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
  invoices: InvoiceResponseNested[];
}

// =============================================================================
// Invoice Types
// =============================================================================

export interface InvoiceBase {
  file_url?: string | null;
  raw_text?: string | null;
  status?: string; // default: "Ожидает сверки"
}

export interface InvoiceCreate extends InvoiceBase {
  purchase_order_id: number;
}

export interface InvoiceUpdate {
  file_url?: string | null;
  raw_text?: string | null;
  status?: string;
}

export interface PaymentResponseNested {
  id: number;
  amount: number;
  bank_transaction_id?: string | null;
  payment_date: DateTime;
  invoice_id: number;
  created_at: DateTime;
}

export interface InvoiceResponse extends InvoiceBase {
  id: number;
  purchase_order_id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
  payments: PaymentResponseNested[];
}

// =============================================================================
// Payment Types
// =============================================================================

export interface PaymentBase {
  amount: number;
  bank_transaction_id?: string | null;
  payment_date: DateTime;
}

export interface PaymentCreate extends PaymentBase {
  invoice_id: number;
}

export interface PaymentUpdate {
  amount?: number;
  bank_transaction_id?: string | null;
  payment_date?: DateTime;
}

export interface PaymentResponse extends PaymentBase {
  id: number;
  invoice_id: number;
  created_at: DateTime;
}

// =============================================================================
// UnresolvedTransaction Types
// =============================================================================

export interface UnresolvedTransactionBase {
  amount: number;
  description?: string | null;
  bank_date: DateTime;
  status?: string; // default: "Не распределено"
}

export interface UnresolvedTransactionCreate extends UnresolvedTransactionBase {}

export interface UnresolvedTransactionUpdate {
  amount?: number;
  description?: string | null;
  bank_date?: DateTime;
  status?: string;
}

export interface UnresolvedTransactionResponse extends UnresolvedTransactionBase {
  id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
}

export interface UnresolvedTransactionListResponse {
  items: UnresolvedTransactionResponse[];
  total: number;
  skip: number;
  limit: number;
}

export interface InvoiceCandidateResponse {
  invoice_id: number;
  supplier_name: string;
  invoice_total: number;
  amount_difference: number;
  confidence_score: number;
}

export interface ManualMatchRequest {
  invoice_id: number;
}

export interface ManualMatchResponse {
  payment_id: number;
  invoice_id: number;
  transaction_id: number;
  amount: number;
  matched_at: DateTime;
}

export interface BulkMatchItem {
  unresolved_transaction_id: number;
  invoice_id: number;
  amount?: number | null;
}

export interface BulkMatchRequest {
  matches: BulkMatchItem[];
}

export interface BulkMatchError {
  unresolved_transaction_id: number;
  invoice_id: number;
  error: string;
}

export interface BulkMatchResponse {
  matched_count: number;
  failed_count: number;
  payment_ids: number[];
  errors: BulkMatchError[];
}

// =============================================================================
// TransactionMatchingAudit Types
// =============================================================================

export interface BankTransactionNested {
  id: number;
  transaction_date: DateTime;
  amount: number;
  supplier_inn?: string | null;
  description?: string | null;
  operation_type: string;
}

export interface UnresolvedTransactionNested {
  id: number;
  amount: number;
  description?: string | null;
  bank_date: DateTime;
  status: string;
}

export interface InvoiceNested {
  id: number;
  status: string;
  purchase_order_id: number;
  created_at: DateTime;
}

export interface TransactionMatchingAuditResponse {
  id: number;
  bank_transaction_id?: number | null;
  unresolved_transaction_id?: number | null;
  invoice_id: number;
  matched_at: DateTime;
  matched_by: string;
  confidence_score?: number | null;
  matching_context?: Record<string, unknown> | null;
  created_at: DateTime;
  bank_transaction?: BankTransactionNested | null;
  unresolved_transaction?: UnresolvedTransactionNested | null;
  invoice?: InvoiceNested | null;
}

export interface AuditHistoryListResponse {
  items: TransactionMatchingAuditResponse[];
  total: number;
  skip: number;
  limit: number;
}

// =============================================================================
// ProductionTask Types
// =============================================================================

export interface ProductionTaskBase {
  status?: string; // default: "Ожидание комплектации"
}

export interface ProductionTaskCreate extends ProductionTaskBase {
  project_id: number;
}

export interface ProductionTaskUpdate {
  status?: string;
}

export interface ProductionTaskResponse extends ProductionTaskBase {
  id: number;
  project_id: number;
  created_at: DateTime;
  updated_at?: DateTime | null;
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface DashboardMetricsResponse {
  paid_invoices_count: number;
  unpaid_invoices_count: number;
  total_paid_amount: number;
  total_unpaid_amount: number;
  pending_invoices_count: number;
  period_start: DateTime;
  period_end: DateTime;
}

export interface PaymentDynamicsPoint {
  date: DateTime;
  paid_amount: number;
  paid_count: number;
}

export interface PaymentDynamicsResponse {
  data: PaymentDynamicsPoint[];
  total_amount: number;
  total_count: number;
  period_start: DateTime;
  period_end: DateTime;
}

export interface UploadBankStatementResponse {
  bank_statement_id: number;
  parsed_transactions: number;
  matched_count: number;
  bank_name: string;
  statement_date: DateTime;
  period_start: DateTime;
  period_end: DateTime;
}

// =============================================================================
// Common API Response Types
// =============================================================================

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

// =============================================================================
// Query Parameter Types
// =============================================================================

export interface ListQueryParams {
  skip?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface DateRangeQueryParams {
  period_start?: string; // ISO date string
  period_end?: string;   // ISO date string
}

export interface PaymentDynamicsQueryParams extends DateRangeQueryParams {
  group_by?: 'day' | 'week' | 'month';
}
