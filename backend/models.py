"""
SQLAlchemy models for the Mini-MRP system.
Based on SPEC.md requirements.
All tables are defined without relationships (to be added later).
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.sql import func
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


class ProjectItem(Base):
    """ProjectItem (BOM) - Bill of Materials for each project."""
    __tablename__ = "project_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=False)  # FK to projects (relationship to be added later)
    name = Column(String(500), nullable=False)
    sku = Column(String(100), nullable=False)  # Stock keeping unit / Артикул
    qty = Column(Integer, nullable=False)  # Quantity needed
    supplier_id = Column(Integer, nullable=True)  # FK to suppliers (nullable)
    stock_item_id = Column(Integer, nullable=True)  # FK to stock_items (nullable)
    status = Column(String(50), nullable=False, default="К закупке")  # К закупке, Запрошено, Счет получен, Оплачено, На складе, В производстве
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Supplier(Base):
    """Supplier entity - vendor information."""
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    requisites = Column(Text, nullable=True)  # Banking details, INN, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class PurchaseOrder(Base):
    """PurchaseOrder - orders sent to suppliers."""
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=False)  # FK to projects
    supplier_id = Column(Integer, nullable=False)  # FK to suppliers
    status = Column(String(50), nullable=False, default="Сформирован")  # Сформирован, Отправлен, Счет сверен, Частичная поставка, Закрыт
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Invoice(Base):
    """Invoice - supplier invoices linked to purchase orders."""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, nullable=False)  # FK to purchase_orders
    file_url = Column(String(500), nullable=True)  # Path to invoice file (PDF/Excel)
    raw_text = Column(Text, nullable=True)  # Extracted text from invoice
    status = Column(String(50), nullable=False, default="Ожидает сверки")  # Ожидает сверки, Ошибки, Сверен, Ожидает оплаты, Оплачен
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Payment(Base):
    """Payment - payments linked to invoices."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, nullable=False)  # FK to invoices
    amount = Column(Numeric(12, 2), nullable=False)  # Payment amount
    bank_transaction_id = Column(String(255), nullable=True)  # Reference to bank transaction
    payment_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


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


class ProductionTask(Base):
    """ProductionTask - manufacturing/assembly tasks for projects."""
    __tablename__ = "production_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=False)  # FK to projects
    status = Column(String(50), nullable=False, default="Ожидание комплектации")  # Ожидание комплектации, В работе, Готов к отгрузке, У заказчика
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
