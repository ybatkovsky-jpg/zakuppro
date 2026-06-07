"""
Pydantic v2 schemas for the Mini-MRP system.
Provides request/response validation for all entities.
Uses from_attributes=True for ORM mode compatibility with SQLAlchemy.
"""
from backend.status_map import map_project_status, map_item_status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from typing import Optional, List, Literal
from datetime import datetime
import enum

# Import canonical enums from the domain model layer (single source of truth)
from backend.models import Role, DelayReason


# =============================================================================
# Base Configuration
# =============================================================================

class BaseSchema(BaseModel):
    """Base schema with ORM mode enabled for Pydantic v2."""
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Auth Schemas
# =============================================================================

class UserBase(BaseSchema):
    """Base user schema."""
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    role: Role = Role.MANAGER


class UserCreate(UserBase):
    """Schema for creating a new user (includes password)."""
    password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    """Schema for user response (excludes password)."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class LoginRequest(BaseSchema):
    """Schema for login request."""
    username: str
    password: str


class LoginResponse(BaseSchema):
    """Schema for login response."""
    access_token: str
    token_type: str = "bearer"
    role: Role


class TokenData(BaseSchema):
    """Schema for verified JWT token payload."""
    user_id: int
    role: Role


# =============================================================================
# Project Schemas
# =============================================================================

class ProjectBase(BaseSchema):
    name: str
    client: str
    status: str = "Проектирование"
    total_cost: Optional[float] = None


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""
    contract_number: Optional[str] = None  # Auto-generated if not provided


class ProjectUpdate(BaseSchema):
    """Schema for updating an existing project."""
    name: Optional[str] = None
    client: Optional[str] = None
    contract_number: Optional[str] = None
    status: Optional[str] = None
    total_cost: Optional[float] = None


class ProjectItemResponse(BaseSchema):
    """Schema for project item in nested responses."""
    id: int
    name: str
    sku: str
    qty: int
    status: str
    supplier_id: Optional[int] = None
    stock_item_id: Optional[int] = None
    price: Optional[float] = None
    unit: Optional[str] = "шт"
    article: Optional[str] = ""
    category: Optional[str] = ""
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProjectResponse(ProjectBase):
    """Schema for project response with nested relationships."""
    id: int
    contract_number: Optional[str] = None
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[ProjectItemResponse] = []


class ProjectReadinessResponse(BaseSchema):
    """Schema for project readiness matrix endpoint response."""
    project_id: int
    project_name: str
    readiness: str  # green, yellow, red
    ready_count: int
    total_count: int
    breakdown: dict[str, int]


# =============================================================================
# ProjectItem Schemas
# =============================================================================

class ProjectItemBase(BaseSchema):
    name: str
    sku: Optional[str] = ""
    qty: int
    status: str = "К закупке"
    supplier_id: Optional[int] = None
    stock_item_id: Optional[int] = None


class ProjectItemCreate(ProjectItemBase):
    """Schema for creating a new project item."""
    project_id: int


class ProjectItemUpdate(BaseSchema):
    """Schema for updating an existing project item."""
    name: Optional[str] = None
    sku: Optional[str] = None
    qty: Optional[int] = None
    status: Optional[str] = None
    supplier_id: Optional[int] = None
    stock_item_id: Optional[int] = None


class ProjectItemResponse(ProjectItemBase):
    """Schema for project item response."""
    id: int
    project_id: int
    sku: Optional[str] = ""
    created_at: datetime
    updated_at: Optional[datetime] = None


# =============================================================================
# Supplier Schemas
# =============================================================================

class SupplierBase(BaseSchema):
    name: str
    email: str
    requisites: Optional[str] = None


class SupplierCreate(SupplierBase):
    """Schema for creating a new supplier."""
    pass


class SupplierUpdate(BaseSchema):
    """Schema for updating an existing supplier."""
    name: Optional[str] = None
    email: Optional[str] = None
    requisites: Optional[str] = None


class SupplierResponse(SupplierBase):
    """Schema for supplier response."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# =============================================================================
# StockItem Schemas
# =============================================================================

class StockItemBase(BaseSchema):
    name: str
    sku: str
    qty_total: int = 0
    qty_reserved: int = 0
    qty_available: int = 0


class StockItemCreate(StockItemBase):
    """Schema for creating a new stock item."""
    pass


class StockItemUpdate(BaseSchema):
    """Schema for updating an existing stock item.

    IMPORTANT: qty_total, qty_reserved, qty_available are intentionally
    excluded from direct update. Mutations must go through
    backend.services.stock_service to enforce the invariant:
        qty_total = qty_reserved + qty_available
    Only name and sku can be updated via this schema.
    """
    name: Optional[str] = None
    sku: Optional[str] = None


class StockItemResponse(StockItemBase):
    """Schema for stock item response."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# =============================================================================
# PurchaseOrder Schemas
# =============================================================================

class PurchaseOrderBase(BaseSchema):
    status: str = "Сформирован"


class PurchaseOrderCreate(PurchaseOrderBase):
    """Schema for creating a new purchase order."""
    project_id: int
    supplier_id: int


class PurchaseOrderUpdate(BaseSchema):
    """Schema for updating an existing purchase order."""
    status: Optional[str] = None


class InvoiceResponse(BaseSchema):
    """Schema for invoice in nested responses."""
    id: int
    file_url: Optional[str] = None
    raw_text: Optional[str] = None
    status: str
    purchase_order_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class PurchaseOrderResponse(PurchaseOrderBase):
    """Schema for purchase order response with nested relationships."""
    id: int
    project_id: int
    supplier_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    invoices: List[InvoiceResponse] = []


# =============================================================================
# Invoice Schemas
# =============================================================================

class InvoiceBase(BaseSchema):
    file_url: Optional[str] = None
    raw_text: Optional[str] = None
    status: str = "Ожидает сверки"


class InvoiceCreate(InvoiceBase):
    """Schema for creating a new invoice."""
    purchase_order_id: int


class InvoiceUpdate(BaseSchema):
    """Schema for updating an existing invoice."""
    file_url: Optional[str] = None
    raw_text: Optional[str] = None
    status: Optional[str] = None


class PaymentResponse(BaseSchema):
    """Schema for payment in nested responses."""
    id: int
    amount: float
    bank_transaction_id: Optional[str] = None
    payment_date: datetime
    invoice_id: int
    created_at: datetime


class InvoiceResponse(InvoiceBase):
    """Schema for invoice response with nested relationships."""
    id: int
    purchase_order_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    payments: List[PaymentResponse] = []


# =============================================================================
# Payment Schemas
# =============================================================================

class PaymentBase(BaseSchema):
    amount: float
    bank_transaction_id: Optional[str] = None
    payment_date: datetime


class PaymentCreate(PaymentBase):
    """Schema for creating a new payment."""
    invoice_id: int


class PaymentUpdate(BaseSchema):
    """Schema for updating an existing payment."""
    amount: Optional[float] = None
    bank_transaction_id: Optional[str] = None
    payment_date: Optional[datetime] = None


class PaymentResponse(PaymentBase):
    """Schema for payment response."""
    id: int
    invoice_id: int
    created_at: datetime


# =============================================================================
# UnresolvedTransaction Schemas
# =============================================================================

class UnresolvedTransactionBase(BaseSchema):
    amount: float
    description: Optional[str] = None
    bank_date: datetime
    status: str = "Не распределено"


class UnresolvedTransactionCreate(UnresolvedTransactionBase):
    """Schema for creating a new unresolved transaction."""
    pass


class UnresolvedTransactionUpdate(BaseSchema):
    """Schema for updating an existing unresolved transaction."""
    amount: Optional[float] = None
    description: Optional[str] = None
    bank_date: Optional[datetime] = None
    status: Optional[str] = None


class UnresolvedTransactionResponse(UnresolvedTransactionBase):
    """Schema for unresolved transaction response."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class UnresolvedTransactionListResponse(BaseSchema):
    """Schema for paginated unresolved transaction list response with metadata."""
    items: List[UnresolvedTransactionResponse]
    total: int
    skip: int
    limit: int


class InvoiceCandidateResponse(BaseSchema):
    """Schema for invoice candidate suggestion response."""
    invoice_id: int
    supplier_name: str
    invoice_total: float
    amount_difference: float
    confidence_score: float


class ManualMatchRequest(BaseSchema):
    """Schema for manual match request."""
    invoice_id: int


class ManualMatchResponse(BaseSchema):
    """Schema for manual match response."""
    payment_id: int
    invoice_id: int
    transaction_id: int
    amount: float
    matched_at: datetime


class BulkMatchItem(BaseSchema):
    """Schema for a single match item in bulk match request."""
    unresolved_transaction_id: int
    invoice_id: int
    amount: Optional[float] = None  # Optional override amount


class BulkMatchRequest(BaseSchema):
    """Schema for bulk match request."""
    matches: List[BulkMatchItem]


class BulkMatchError(BaseSchema):
    """Schema for a single error in bulk match response."""
    unresolved_transaction_id: int
    invoice_id: int
    error: str


class BulkMatchResponse(BaseSchema):
    """Schema for bulk match response."""
    matched_count: int
    failed_count: int
    payment_ids: List[int]
    errors: List[BulkMatchError]


# =============================================================================
# TransactionMatchingAudit Schemas
# =============================================================================

class BankTransactionNested(BaseSchema):
    """Schema for bank transaction in nested audit responses."""
    id: int
    transaction_date: datetime
    amount: float
    supplier_inn: Optional[str] = None
    description: Optional[str] = None
    operation_type: str


class UnresolvedTransactionNested(BaseSchema):
    """Schema for unresolved transaction in nested audit responses."""
    id: int
    amount: float
    description: Optional[str] = None
    bank_date: datetime
    status: str


class InvoiceNested(BaseSchema):
    """Schema for invoice in nested audit responses."""
    id: int
    status: str
    purchase_order_id: int
    created_at: datetime


class TransactionMatchingAuditResponse(BaseSchema):
    """Schema for transaction matching audit response."""
    id: int
    bank_transaction_id: Optional[int] = None
    unresolved_transaction_id: Optional[int] = None
    invoice_id: int
    matched_at: datetime
    matched_by: str
    confidence_score: Optional[float] = None
    matching_context: Optional[dict] = None
    created_at: datetime
    bank_transaction: Optional[BankTransactionNested] = None
    unresolved_transaction: Optional[UnresolvedTransactionNested] = None
    invoice: Optional[InvoiceNested] = None


class AuditHistoryListResponse(BaseSchema):
    """Schema for paginated audit history list response."""
    items: List[TransactionMatchingAuditResponse]
    total: int
    skip: int
    limit: int


# =============================================================================
# ProductionTask Schemas
# =============================================================================
# NOTE: DelayReason is imported from backend.models (single source of truth).

class ProductionTaskBase(BaseSchema):
    status: str = "Ожидание комплектации"
    expected_completion_date: Optional[datetime] = None
    delay_reason: Optional[DelayReason] = None
    custom_reason: Optional[str] = None


class ProductionTaskCreate(ProductionTaskBase):
    """Schema for creating a new production task."""
    project_id: int


class ProductionTaskUpdate(BaseSchema):
    """Schema for updating an existing production task."""
    status: Optional[str] = None
    expected_completion_date: Optional[datetime] = None
    delay_reason: Optional[DelayReason] = None
    custom_reason: Optional[str] = None


class ProductionTaskResponse(ProductionTaskBase):
    """Schema for production task response."""
    id: int
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# =============================================================================
# Analytics Schemas
# =============================================================================

class DashboardMetricsResponse(BaseSchema):
    """Schema for dashboard metrics response."""
    paid_invoices_count: int
    unpaid_invoices_count: int
    total_paid_amount: float
    total_unpaid_amount: float
    pending_invoices_count: int
    period_start: datetime
    period_end: datetime


class PaymentDynamicsPoint(BaseSchema):
    """Schema for a single data point in payment dynamics time series."""
    date: datetime
    paid_amount: float
    paid_count: int


class PaymentDynamicsResponse(BaseSchema):
    """Schema for payment dynamics time series response."""
    data: List[PaymentDynamicsPoint]
    total_amount: float
    total_count: int
    period_start: datetime
    period_end: datetime


class UploadBankStatementResponse(BaseSchema):
    """Schema for bank statement upload response."""
    bank_statement_id: int
    parsed_transactions: int
    matched_count: int
    bank_name: str
    statement_date: datetime
    period_start: datetime
    period_end: datetime


# =============================================================================
# FailedTask (DLQ) Schemas
# =============================================================================

class FailedTaskResponse(BaseSchema):
    """Schema for FailedTask (Dead Letter Queue) response."""
    id: int
    task_id: str
    task_name: str
    error_message: str
    error_type: str
    file_path: Optional[str] = None
    chat_id: Optional[int] = None
    context: Optional[str] = None
    created_at: datetime


class FailedTaskListResponse(BaseSchema):
    """Schema for paginated FailedTask list response."""
    items: List[FailedTaskResponse]
    total: int
    skip: int
    limit: int


# =============================================================================
# Stock Reservation / Goods Receipt Schemas (M006)
# =============================================================================

class StockReceiveRequest(BaseModel):
    """Schema for receiving goods into stock (goods receipt)."""
    qty: int = Field(..., gt=0)


class ProjectStatusHistoryResponse(BaseSchema):
    """Schema for project status change audit trail."""
    id: int
    project_id: int
    from_status: str
    to_status: str
    changed_by: Optional[int] = None
    changed_at: datetime


# =============================================================================
# Integration API Schemas (FinPro sync)
# =============================================================================

class IntegrationProjectItem(BaseSchema):
    """Schema for project item in integration responses."""
    id: int
    name: str
    sku: str
    qty: int
    status: str
    supplier_id: Optional[int] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProjectSyncItem(BaseSchema):
    """Schema for a single project in the integration sync response."""
    id: int
    contract_number: Optional[str] = None
    name: str
    client: str
    status: str
    total_cost: Optional[float] = None
    owner_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[IntegrationProjectItem] = []


class ProjectSyncResponse(BaseSchema):
    """Schema for paginated project sync response."""
    items: List[ProjectSyncItem]
    total: int
    page: int
    limit: int


class ProcurementLine(BaseSchema):
    """Schema for a single procurement line item."""
    id: int
    project_contract_number: str
    date: datetime
    amount: float
    category: str  # "Материалы", "Доставка", "Комплектующие"
    counterparty_name: str
    document_ref: Optional[str] = None  # Номер счета/накладной
    status: str  # "approved", "paid", "cancelled"


class ProcurementResponse(BaseSchema):
    """Schema for procurement data response."""
    project_contract_number: str
    lines: List[ProcurementLine]
    total_amount: float


class ProductionLine(BaseSchema):
    """Schema for a single production line item."""
    id: int
    project_contract_number: str
    date: datetime
    amount: float  # Стоимость работ/сдельная оплата
    description: str  # "Распил", "Сборка корпуса", "Покраска"
    status: str  # "in_progress", "completed", "accepted"


class ProductionResponse(BaseSchema):
    """Schema for production data response."""
    project_contract_number: str
    lines: List[ProductionLine]
    total_amount: float
