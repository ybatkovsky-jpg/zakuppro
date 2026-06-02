"""
Pydantic v2 schemas for the Mini-MRP system.
Provides request/response validation for all entities.
Uses from_attributes=True for ORM mode compatibility with SQLAlchemy.
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# =============================================================================
# Base Configuration
# =============================================================================

class BaseSchema(BaseModel):
    """Base schema with ORM mode enabled for Pydantic v2."""
    model_config = ConfigDict(from_attributes=True)


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
    pass


class ProjectUpdate(BaseSchema):
    """Schema for updating an existing project."""
    name: Optional[str] = None
    client: Optional[str] = None
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
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProjectResponse(ProjectBase):
    """Schema for project response with nested relationships."""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[ProjectItemResponse] = []


# =============================================================================
# ProjectItem Schemas
# =============================================================================

class ProjectItemBase(BaseSchema):
    name: str
    sku: str
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
    """Schema for updating an existing stock item."""
    name: Optional[str] = None
    sku: Optional[str] = None
    qty_total: Optional[int] = None
    qty_reserved: Optional[int] = None
    qty_available: Optional[int] = None


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
# ProductionTask Schemas
# =============================================================================

class ProductionTaskBase(BaseSchema):
    status: str = "Ожидание комплектации"


class ProductionTaskCreate(ProductionTaskBase):
    """Schema for creating a new production task."""
    project_id: int


class ProductionTaskUpdate(BaseSchema):
    """Schema for updating an existing production task."""
    status: Optional[str] = None


class ProductionTaskResponse(ProductionTaskBase):
    """Schema for production task response."""
    id: int
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
