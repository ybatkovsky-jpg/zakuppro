"""
Backend schemas package.

Exports all Pydantic schemas for API request/response validation.
This package re-exports schemas from the schemas.py file to maintain compatibility
with existing imports while organizing the code better.
"""
# Import verification schemas from submodule
from backend.schemas.verification import (
    ItemVerification,
    QuantityDiscrepancy,
    VerificationResult,
)

# Import schemas from the schemas.py file using a direct import to avoid circular reference
# We use importlib to load schemas.py as a separate module
import importlib.util
import os

# Load schemas.py as a module to avoid circular import
schemas_file_path = os.path.join(os.path.dirname(__file__), '..', 'schemas.py')
spec = importlib.util.spec_from_file_location("_schemas_file", schemas_file_path)
_schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(_schemas)

# Re-export all schemas
BaseSchema = _schemas.BaseSchema

# Auth schemas
Role = _schemas.Role
UserBase = _schemas.UserBase
UserCreate = _schemas.UserCreate
UserResponse = _schemas.UserResponse
LoginRequest = _schemas.LoginRequest
LoginResponse = _schemas.LoginResponse
TokenData = _schemas.TokenData

# Project schemas
ProjectBase = _schemas.ProjectBase
ProjectCreate = _schemas.ProjectCreate
ProjectUpdate = _schemas.ProjectUpdate
ProjectResponse = _schemas.ProjectResponse
ProjectReadinessResponse = _schemas.ProjectReadinessResponse
ProjectItemResponse = _schemas.ProjectItemResponse

# ProjectItem schemas
ProjectItemBase = _schemas.ProjectItemBase
ProjectItemCreate = _schemas.ProjectItemCreate
ProjectItemUpdate = _schemas.ProjectItemUpdate

# Supplier schemas
SupplierBase = _schemas.SupplierBase
SupplierCreate = _schemas.SupplierCreate
SupplierUpdate = _schemas.SupplierUpdate
SupplierResponse = _schemas.SupplierResponse

# StockItem schemas
StockItemBase = _schemas.StockItemBase
StockItemCreate = _schemas.StockItemCreate
StockItemUpdate = _schemas.StockItemUpdate
StockItemResponse = _schemas.StockItemResponse

# PurchaseOrder schemas
PurchaseOrderBase = _schemas.PurchaseOrderBase
PurchaseOrderCreate = _schemas.PurchaseOrderCreate
PurchaseOrderUpdate = _schemas.PurchaseOrderUpdate
PurchaseOrderResponse = _schemas.PurchaseOrderResponse

# Invoice schemas
InvoiceBase = _schemas.InvoiceBase
InvoiceCreate = _schemas.InvoiceCreate
InvoiceUpdate = _schemas.InvoiceUpdate
InvoiceResponse = _schemas.InvoiceResponse

# Payment schemas
PaymentBase = _schemas.PaymentBase
PaymentCreate = _schemas.PaymentCreate
PaymentUpdate = _schemas.PaymentUpdate
PaymentResponse = _schemas.PaymentResponse

# UnresolvedTransaction schemas
UnresolvedTransactionBase = _schemas.UnresolvedTransactionBase
UnresolvedTransactionCreate = _schemas.UnresolvedTransactionCreate
UnresolvedTransactionUpdate = _schemas.UnresolvedTransactionUpdate
UnresolvedTransactionResponse = _schemas.UnresolvedTransactionResponse
UnresolvedTransactionListResponse = _schemas.UnresolvedTransactionListResponse
InvoiceCandidateResponse = _schemas.InvoiceCandidateResponse
ManualMatchRequest = _schemas.ManualMatchRequest
ManualMatchResponse = _schemas.ManualMatchResponse
BulkMatchItem = _schemas.BulkMatchItem
BulkMatchRequest = _schemas.BulkMatchRequest
BulkMatchResponse = _schemas.BulkMatchResponse
BulkMatchError = _schemas.BulkMatchError

# TransactionMatchingAudit schemas
BankTransactionNested = _schemas.BankTransactionNested
UnresolvedTransactionNested = _schemas.UnresolvedTransactionNested
InvoiceNested = _schemas.InvoiceNested
TransactionMatchingAuditResponse = _schemas.TransactionMatchingAuditResponse
AuditHistoryListResponse = _schemas.AuditHistoryListResponse

# ProductionTask schemas
ProductionTaskBase = _schemas.ProductionTaskBase
ProductionTaskCreate = _schemas.ProductionTaskCreate
ProductionTaskUpdate = _schemas.ProductionTaskUpdate
ProductionTaskResponse = _schemas.ProductionTaskResponse

# Analytics schemas
DashboardMetricsResponse = _schemas.DashboardMetricsResponse
PaymentDynamicsPoint = _schemas.PaymentDynamicsPoint
PaymentDynamicsResponse = _schemas.PaymentDynamicsResponse
UploadBankStatementResponse = _schemas.UploadBankStatementResponse

# Stock Reservation / Goods Receipt schemas (M006)
StockReceiveRequest = _schemas.StockReceiveRequest
ProjectStatusHistoryResponse = _schemas.ProjectStatusHistoryResponse

__all__ = [
    # Verification
    "ItemVerification",
    "QuantityDiscrepancy",
    "VerificationResult",
    # Base
    "BaseSchema",
    # Auth
    "Role",
    "UserBase",
    "UserCreate",
    "UserResponse",
    "LoginRequest",
    "LoginResponse",
    "TokenData",
    # Projects
    "ProjectBase",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ProjectReadinessResponse",
    "ProjectItemResponse",
    # ProjectItems
    "ProjectItemBase",
    "ProjectItemCreate",
    "ProjectItemUpdate",
    # Suppliers
    "SupplierBase",
    "SupplierCreate",
    "SupplierUpdate",
    "SupplierResponse",
    # StockItems
    "StockItemBase",
    "StockItemCreate",
    "StockItemUpdate",
    "StockItemResponse",
    # PurchaseOrders
    "PurchaseOrderBase",
    "PurchaseOrderCreate",
    "PurchaseOrderUpdate",
    "PurchaseOrderResponse",
    # Invoices
    "InvoiceBase",
    "InvoiceCreate",
    "InvoiceUpdate",
    "InvoiceResponse",
    # Payments
    "PaymentBase",
    "PaymentCreate",
    "PaymentUpdate",
    "PaymentResponse",
    # UnresolvedTransactions
    "UnresolvedTransactionBase",
    "UnresolvedTransactionCreate",
    "UnresolvedTransactionUpdate",
    "UnresolvedTransactionResponse",
    "UnresolvedTransactionListResponse",
    "InvoiceCandidateResponse",
    "ManualMatchRequest",
    "ManualMatchResponse",
    "BulkMatchItem",
    "BulkMatchRequest",
    "BulkMatchResponse",
    "BulkMatchError",
    # TransactionMatchingAudit
    "BankTransactionNested",
    "UnresolvedTransactionNested",
    "InvoiceNested",
    "TransactionMatchingAuditResponse",
    "AuditHistoryListResponse",
    # ProductionTasks
    "ProductionTaskBase",
    "ProductionTaskCreate",
    "ProductionTaskUpdate",
    "ProductionTaskResponse",
    # Analytics
    "DashboardMetricsResponse",
    "PaymentDynamicsPoint",
    "PaymentDynamicsResponse",
    "UploadBankStatementResponse",
    # Stock Reservation / Goods Receipt (M006)
    "StockReceiveRequest",
    "ProjectStatusHistoryResponse",
]
