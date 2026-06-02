"""
SQLAlchemy models for the Mini-MRP system.
Based on SPEC.md requirements.
All tables are defined without relationships (to be added later).
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Boolean, LargeBinary, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# Handle both cases: when backend is a package and when running directly from backend directory
try:
    from backend.database import Base
except ImportError:
    from database import Base


class Project(Base):
    """Project entity - main project management."""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    client = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="Проектирование")  # Канбан: Проектирование, Закупки, В производстве, Монтаж
    total_cost = Column(Numeric(12, 2), nullable=True)  # Decimal for financial precision
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    items = relationship("ProjectItem", back_populates="project", cascade="all, delete-orphan", lazy="selectin")
    purchase_orders = relationship("PurchaseOrder", back_populates="project", lazy="selectin")
    production_tasks = relationship("ProductionTask", back_populates="project", lazy="selectin")


class ProjectItem(Base):
    """ProjectItem (BOM) - Bill of Materials for each project."""
    __tablename__ = "project_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(500), nullable=False)
    sku = Column(String(100), nullable=False)  # Stock keeping unit / Артикул
    qty = Column(Integer, nullable=False)  # Quantity needed
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=True)
    status = Column(String(50), nullable=False, default="К закупке")  # К закупке, Запрошено, Счет получен, Оплачено, На складе, В производстве
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="items")
    supplier = relationship("Supplier", back_populates="project_items")
    stock_item = relationship("StockItem", back_populates="project_items")


class Supplier(Base):
    """Supplier entity - vendor information."""
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    requisites = Column(Text, nullable=True)  # Banking details, INN, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier", lazy="selectin")
    project_items = relationship("ProjectItem", back_populates="supplier")


class PurchaseOrder(Base):
    """PurchaseOrder - orders sent to suppliers."""
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    status = Column(String(50), nullable=False, default="Сформирован")  # Сформирован, Отправлен, Счет сверен, Частичная поставка, Закрыт
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="purchase_orders")
    supplier = relationship("Supplier", back_populates="purchase_orders")
    invoices = relationship("Invoice", back_populates="purchase_order", lazy="selectin")


class Invoice(Base):
    """Invoice - supplier invoices linked to purchase orders."""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    file_url = Column(String(500), nullable=True)  # Path to invoice file (PDF/Excel)
    raw_text = Column(Text, nullable=True)  # Extracted text from invoice
    raw_file = Column(LargeBinary, nullable=True)  # Binary invoice file data (BLOB storage)
    verification_result = Column(JSON, nullable=True)  # LLM verification results (JSONB in PostgreSQL)
    status = Column(String(50), nullable=False, default="Ожидает сверки")  # Ожидает сверки, Ошибки, Сверен, Ожидает оплаты, Оплачен
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice", lazy="selectin")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")


class InvoiceItem(Base):
    """InvoiceItem - line items from supplier invoices with BOM mapping."""
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    project_item_id = Column(Integer, ForeignKey("project_items.id"), nullable=True)  # Nullable for unmapped items
    name = Column(String(500), nullable=False)  # Item name from invoice
    sku = Column(String(100), nullable=False)  # Stock keeping unit from invoice
    qty = Column(Integer, nullable=False)  # Quantity from invoice
    unit_price = Column(Numeric(12, 2), nullable=False)  # Unit price from invoice
    total_price = Column(Numeric(12, 2), nullable=False)  # Line total (qty * unit_price)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    project_item = relationship("ProjectItem")  # Optional mapping to project BOM


class Payment(Base):
    """Payment - payments linked to invoices."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)  # Payment amount
    bank_transaction_id = Column(String(255), nullable=True)  # Reference to bank transaction
    payment_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")


class UnresolvedTransaction(Base):
    """UnresolvedTransaction - bank transactions that couldn't be auto-mapped."""
    __tablename__ = "unresolved_transactions"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=True)  # Transaction description from bank
    bank_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), nullable=False, default="Не распределено")  # Не распределено, Привязано вручную
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class StockItem(Base):
    """StockItem - warehouse inventory items."""
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), nullable=False)
    sku = Column(String(100), nullable=False, unique=True)  # Stock keeping unit
    qty_total = Column(Integer, nullable=False, default=0)  # Total quantity in stock
    qty_reserved = Column(Integer, nullable=False, default=0)  # Reserved for projects
    qty_available = Column(Integer, nullable=False, default=0)  # Available for new orders
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project_items = relationship("ProjectItem", back_populates="stock_item")


class ProductionTask(Base):
    """ProductionTask - manufacturing/assembly tasks for projects."""
    __tablename__ = "production_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    status = Column(String(50), nullable=False, default="Ожидание комплектации")  # Ожидание комплектации, В работе, Готов к отгрузке, У заказчика
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="production_tasks")


class BankStatement(Base):
    """BankStatement - bank statement file upload for reconciliation."""
    __tablename__ = "bank_statements"

    id = Column(Integer, primary_key=True, index=True)
    bank_name = Column(String(100), nullable=False)  # Tinkoff, Ozon, etc.
    statement_date = Column(DateTime(timezone=True), nullable=False)  # Statement date from bank
    period_start = Column(DateTime(timezone=True), nullable=False)  # Period start date
    period_end = Column(DateTime(timezone=True), nullable=False)  # Period end date
    raw_file = Column(LargeBinary, nullable=True)  # Original 1C ClientBank file (BLOB)
    status = Column(String(50), nullable=False, default="Обрабатывается")  # Обрабатывается, Ошибки, Готов
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    transactions = relationship("BankTransaction", back_populates="bank_statement", cascade="all, delete-orphan", lazy="selectin")


class BankTransaction(Base):
    """BankTransaction - individual transactions from bank statements."""
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    bank_statement_id = Column(Integer, ForeignKey("bank_statements.id"), nullable=False)
    transaction_date = Column(DateTime(timezone=True), nullable=False, index=True)  # ix_bank_transactions_transaction_date
    amount = Column(Numeric(12, 2), nullable=False, index=True)  # ix_bank_transactions_amount
    supplier_inn = Column(String(12), nullable=True, index=True)  # ix_bank_transactions_supplier_inn
    description = Column(Text, nullable=True)  # Transaction description/purpose
    operation_type = Column(String(50), nullable=False)  # Debit, Credit, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    bank_statement = relationship("BankStatement", back_populates="transactions")
    matching_audits = relationship("TransactionMatchingAudit", back_populates="bank_transaction", lazy="selectin")


class TransactionMatchingAudit(Base):
    """TransactionMatchingAudit - audit trail for auto-matched and manually matched transactions."""
    __tablename__ = "transaction_matching_audits"

    id = Column(Integer, primary_key=True, index=True)
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)  # Nullable for manual matches from UnresolvedTransaction
    unresolved_transaction_id = Column(Integer, ForeignKey("unresolved_transactions.id"), nullable=True)  # Tracks manual matches from unresolved queue
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    matched_at = Column(DateTime(timezone=True), nullable=False)
    matched_by = Column(String(50), nullable=False)  # 'auto', 'manual', or user_id
    confidence_score = Column(Numeric(3, 2), nullable=True)  # 0.00-1.00 confidence score
    matching_context = Column(JSON, nullable=True)  # Matching algorithm details (JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    bank_transaction = relationship("BankTransaction", back_populates="matching_audits")
    invoice = relationship("Invoice")  # No back_populates - Invoice doesn't track matches


class FailedTask(Base):
    """FailedTask - Dead Letter Queue (DLQ) for failed Celery tasks."""
    __tablename__ = "failed_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(255), unique=True, nullable=False, index=True)  # Celery task UUID
    task_name = Column(String(100), nullable=False)  # Task function name
    error_message = Column(Text, nullable=False)  # Full error traceback/message
    error_type = Column(String(100), nullable=False)  # Exception class name
    file_path = Column(String(500), nullable=True)  # Input file path (e.g., Excel from Telegram)
    chat_id = Column(Integer, nullable=True)  # Telegram chat_id for user notification
    context = Column(Text, nullable=True)  # JSON context for debugging/reprocessing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
