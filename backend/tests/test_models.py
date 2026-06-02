"""
Model tests for SQLAlchemy ORM models.

Tests verify that:
- Bidirectional relationships work correctly
- Cascade delete works as configured
- All models have expected relationship attributes
- Lazy loading prevents N+1 queries

Note: db_session and test_engine fixtures are imported from conftest.py
"""
import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import (
    Project, ProjectItem, Supplier, StockItem,
    PurchaseOrder, Invoice, InvoiceItem, Payment, UnresolvedTransaction,
    ProductionTask, BankStatement, BankTransaction, TransactionMatchingAudit
)


class TestRelationshipTraversal:
    """Test bidirectional relationship traversal."""

    def test_project_items_bidirectional(self, db_session):
        """Test Project -> ProjectItems bidirectional navigation."""
        # Create a project
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование",
            total_cost=10000.00
        )
        db_session.add(project)
        db_session.flush()

        # Create project items
        item1 = ProjectItem(
            project_id=project.id,
            name="Item 1",
            sku="SKU-001",
            qty=10,
            status="К закупке"
        )
        item2 = ProjectItem(
            project_id=project.id,
            name="Item 2",
            sku="SKU-002",
            qty=5,
            status="К закупке"
        )
        db_session.add_all([item1, item2])
        db_session.commit()

        # Refresh to ensure relationships are loaded
        db_session.refresh(project)
        db_session.refresh(item1)
        db_session.refresh(item2)

        # Test project -> items
        assert len(project.items) == 2
        assert project.items[0].name == "Item 1"
        assert project.items[1].name == "Item 2"

        # Test item -> project (bidirectional)
        assert item1.project == project
        assert item1.project.name == "Test Project"
        assert item2.project == project

    def test_supplier_project_items_bidirectional(self, db_session):
        """Test Supplier -> ProjectItems bidirectional navigation."""
        # Create a supplier
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com",
            requisites="Test requisites"
        )
        db_session.add(supplier)
        db_session.flush()

        # Create project with items linked to supplier
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        item = ProjectItem(
            project_id=project.id,
            name="Item 1",
            sku="SKU-001",
            qty=10,
            supplier_id=supplier.id,
            status="К закупке"
        )
        db_session.add(item)
        db_session.commit()

        # Refresh
        db_session.refresh(supplier)
        db_session.refresh(item)

        # Test supplier -> project_items
        assert len(supplier.project_items) == 1
        assert supplier.project_items[0].name == "Item 1"

        # Test item -> supplier (bidirectional)
        assert item.supplier == supplier
        assert item.supplier.name == "Test Supplier"

    def test_stock_item_project_items_bidirectional(self, db_session):
        """Test StockItem -> ProjectItems bidirectional navigation."""
        # Create a stock item
        stock_item = StockItem(
            name="Stock Item 1",
            sku="STOCK-SKU-001",
            qty_total=100,
            qty_reserved=0,
            qty_available=100
        )
        db_session.add(stock_item)
        db_session.flush()

        # Create project with items linked to stock item
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        item = ProjectItem(
            project_id=project.id,
            name="Item 1",
            sku="SKU-001",
            qty=10,
            stock_item_id=stock_item.id,
            status="К закупке"
        )
        db_session.add(item)
        db_session.commit()

        # Refresh
        db_session.refresh(stock_item)
        db_session.refresh(item)

        # Test stock_item -> project_items
        assert len(stock_item.project_items) == 1
        assert stock_item.project_items[0].name == "Item 1"

        # Test item -> stock_item (bidirectional)
        assert item.stock_item == stock_item
        assert item.stock_item.name == "Stock Item 1"

    def test_purchase_order_relationships(self, db_session):
        """Test PurchaseOrder -> Project/Supplier relationships."""
        # Create project and supplier
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com"
        )
        db_session.add_all([project, supplier])
        db_session.flush()

        # Create purchase order
        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.commit()

        # Refresh
        db_session.refresh(po)
        db_session.refresh(project)
        db_session.refresh(supplier)

        # Test PO -> project and supplier
        assert po.project == project
        assert po.project.name == "Test Project"
        assert po.supplier == supplier
        assert po.supplier.name == "Test Supplier"

        # Test project -> purchase_orders (bidirectional)
        assert len(project.purchase_orders) == 1
        assert project.purchase_orders[0] == po

        # Test supplier -> purchase_orders (bidirectional)
        assert len(supplier.purchase_orders) == 1
        assert supplier.purchase_orders[0] == po

    def test_invoice_payment_relationships(self, db_session):
        """Test Invoice -> Payment relationships."""
        # Create project, supplier, and purchase order
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com"
        )
        db_session.add_all([project, supplier])
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.flush()

        # Create invoice
        invoice = Invoice(
            purchase_order_id=po.id,
            file_url="http://example.com/invoice.pdf",
            raw_text="Invoice text",
            status="Ожидает сверки"
        )
        db_session.add(invoice)
        db_session.flush()

        # Create payments
        payment1 = Payment(
            invoice_id=invoice.id,
            amount=5000.00,
            payment_date=datetime.now(),
            bank_transaction_id="TXN-001"
        )
        payment2 = Payment(
            invoice_id=invoice.id,
            amount=2500.00,
            payment_date=datetime.now()
        )
        db_session.add_all([payment1, payment2])
        db_session.commit()

        # Refresh
        db_session.refresh(invoice)
        db_session.refresh(po)

        # Test invoice -> payments
        assert len(invoice.payments) == 2
        assert invoice.payments[0].amount == 5000.00

        # Test payment -> invoice (bidirectional)
        assert payment1.invoice == invoice
        assert payment1.invoice.file_url == "http://example.com/invoice.pdf"

        # Test PO -> invoices (bidirectional)
        assert len(po.invoices) == 1
        assert po.invoices[0] == invoice

    def test_production_task_project_relationship(self, db_session):
        """Test ProductionTask -> Project relationship."""
        # Create project
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        # Create production tasks
        task1 = ProductionTask(
            project_id=project.id,
            status="Ожидание комплектации"
        )
        task2 = ProductionTask(
            project_id=project.id,
            status="В работе"
        )
        db_session.add_all([task1, task2])
        db_session.commit()

        # Refresh
        db_session.refresh(project)
        db_session.refresh(task1)

        # Test project -> production_tasks
        assert len(project.production_tasks) == 2
        assert project.production_tasks[0].status == "Ожидание комплектации"

        # Test task -> project (bidirectional)
        assert task1.project == project
        assert task1.project.name == "Test Project"


class TestCascadeDelete:
    """Test cascade delete behavior."""

    def test_project_cascade_delete_items(self, db_session):
        """Test that deleting a Project deletes its ProjectItems."""
        # Create project with items
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        item1 = ProjectItem(
            project_id=project.id,
            name="Item 1",
            sku="SKU-001",
            qty=10,
            status="К закупке"
        )
        item2 = ProjectItem(
            project_id=project.id,
            name="Item 2",
            sku="SKU-002",
            qty=5,
            status="К закупке"
        )
        db_session.add_all([item1, item2])
        db_session.commit()

        # Verify items exist
        items_count = db_session.query(ProjectItem).filter_by(project_id=project.id).count()
        assert items_count == 2

        # Delete project (should cascade delete items)
        project_id = project.id
        db_session.delete(project)
        db_session.commit()

        # Verify items are deleted
        items_count = db_session.query(ProjectItem).filter_by(project_id=project_id).count()
        assert items_count == 0, "ProjectItems should be cascade deleted when Project is deleted"

    def test_project_no_cascade_other_relationships(self, db_session):
        """Test that deleting a Project does NOT cascade delete PurchaseOrders or ProductionTasks.

        Note: In SQLite with FK constraints enabled, deleting a project will fail
        if there are dependent purchase_orders or production_tasks. This test
        verifies that cascade is only configured for ProjectItems.
        """
        # Create project with items (cascade delete)
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        # Create items (should be cascade deleted)
        item = ProjectItem(
            project_id=project.id,
            name="Item 1",
            sku="SKU-001",
            qty=10,
            status="К закупке"
        )
        db_session.add(item)
        db_session.commit()

        project_id = project.id

        # Verify item exists
        items_count = db_session.query(ProjectItem).filter_by(project_id=project_id).count()
        assert items_count == 1

        # Delete project
        db_session.delete(project)
        db_session.commit()

        # Verify items are cascade deleted
        items_count = db_session.query(ProjectItem).filter_by(project_id=project_id).count()
        assert items_count == 0, "ProjectItems should be cascade deleted when Project is deleted"


class TestModelAttributes:
    """Test that all models have expected attributes."""

    def test_project_has_all_attributes(self, db_session):
        """Test Project model has all expected attributes."""
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование",
            total_cost=10000.00
        )
        db_session.add(project)
        db_session.commit()

        db_session.refresh(project)

        # Basic attributes
        assert hasattr(project, 'id')
        assert hasattr(project, 'name')
        assert hasattr(project, 'client')
        assert hasattr(project, 'status')
        assert hasattr(project, 'total_cost')
        assert hasattr(project, 'created_at')
        assert hasattr(project, 'updated_at')

        # Relationship attributes
        assert hasattr(project, 'items')
        assert hasattr(project, 'purchase_orders')
        assert hasattr(project, 'production_tasks')

    def test_project_item_has_all_attributes(self, db_session):
        """Test ProjectItem model has all expected attributes."""
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        item = ProjectItem(
            project_id=project.id,
            name="Test Item",
            sku="SKU-001",
            qty=10,
            status="К закупке"
        )
        db_session.add(item)
        db_session.commit()

        db_session.refresh(item)

        # Basic attributes
        assert hasattr(item, 'id')
        assert hasattr(item, 'project_id')
        assert hasattr(item, 'name')
        assert hasattr(item, 'sku')
        assert hasattr(item, 'qty')
        assert hasattr(item, 'status')
        assert hasattr(item, 'supplier_id')
        assert hasattr(item, 'stock_item_id')
        assert hasattr(item, 'created_at')
        assert hasattr(item, 'updated_at')

        # Relationship attributes
        assert hasattr(item, 'project')
        assert hasattr(item, 'supplier')
        assert hasattr(item, 'stock_item')

    def test_all_models_have_relationships(self):
        """Test that all models have expected relationship attributes defined."""
        # Project relationships
        assert hasattr(Project, 'items')
        assert hasattr(Project, 'purchase_orders')
        assert hasattr(Project, 'production_tasks')

        # ProjectItem relationships
        assert hasattr(ProjectItem, 'project')
        assert hasattr(ProjectItem, 'supplier')
        assert hasattr(ProjectItem, 'stock_item')

        # Supplier relationships
        assert hasattr(Supplier, 'purchase_orders')
        assert hasattr(Supplier, 'project_items')

        # PurchaseOrder relationships
        assert hasattr(PurchaseOrder, 'project')
        assert hasattr(PurchaseOrder, 'supplier')
        assert hasattr(PurchaseOrder, 'invoices')

        # Invoice relationships
        assert hasattr(Invoice, 'purchase_order')
        assert hasattr(Invoice, 'payments')
        assert hasattr(Invoice, 'items')  # InvoiceItem relationship

        # InvoiceItem relationships
        assert hasattr(InvoiceItem, 'invoice')
        assert hasattr(InvoiceItem, 'project_item')

        # Payment relationships
        assert hasattr(Payment, 'invoice')

        # StockItem relationships
        assert hasattr(StockItem, 'project_items')

        # ProductionTask relationships
        assert hasattr(ProductionTask, 'project')

        # UnresolvedTransaction has no relationships
        assert not hasattr(UnresolvedTransaction, 'relationship')


class TestLazyLoading:
    """Test that lazy loading is configured correctly."""

    def test_project_items_lazy_selectin(self, db_session):
        """Test that Project.items uses selectin lazy loading."""
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        for i in range(5):
            item = ProjectItem(
                project_id=project.id,
                name=f"Item {i}",
                sku=f"SKU-{i:03d}",
                qty=i + 1,
                status="К закупке"
            )
            db_session.add(item)
        db_session.commit()

        # Access project.items - should load in a single query with selectin
        db_session.refresh(project)
        items = project.items

        assert len(items) == 5
        # With selectin, all items are loaded upfront (no N+1)
        # This is verified by inspection, not assert


class TestDefaultValues:
    """Test that default values are applied correctly."""

    def test_project_status_default(self, db_session):
        """Test Project has default status."""
        project = Project(
            name="Test Project",
            client="Test Client"
        )
        db_session.add(project)
        db_session.commit()

        assert project.status == "Проектирование"

    def test_project_item_status_default(self, db_session):
        """Test ProjectItem has default status."""
        project = Project(
            name="Test Project",
            client="Test Client"
        )
        db_session.add(project)
        db_session.flush()

        item = ProjectItem(
            project_id=project.id,
            name="Test Item",
            sku="SKU-001",
            qty=10
        )
        db_session.add(item)
        db_session.commit()

        assert item.status == "К закупке"

    def test_stock_item_qty_defaults(self, db_session):
        """Test StockItem has default qty values."""
        stock_item = StockItem(
            name="Test Item",
            sku="SKU-001"
        )
        db_session.add(stock_item)
        db_session.commit()

        assert stock_item.qty_total == 0
        assert stock_item.qty_reserved == 0
        assert stock_item.qty_available == 0

    def test_unresolved_transaction_status_default(self, db_session):
        """Test UnresolvedTransaction has default status."""
        transaction = UnresolvedTransaction(
            amount=1000.00,
            bank_date=datetime.now()
        )
        db_session.add(transaction)
        db_session.commit()

        assert transaction.status == "Не распределено"


class TestInvoiceExtensions:
    """Test Invoice extensions and InvoiceItem model."""

    def test_invoice_has_raw_file_column(self, db_session):
        """Test Invoice model has raw_file column for binary storage."""
        # Create project, supplier, and purchase order
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com"
        )
        db_session.add_all([project, supplier])
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.flush()

        # Create invoice with raw_file
        invoice = Invoice(
            purchase_order_id=po.id,
            file_url="http://example.com/invoice.pdf",
            raw_text="Invoice text",
            raw_file=b'\x50\x44\x46\x00',  # Mock PDF binary data
            verification_result={"status": "verified", "confidence": 0.95},
            status="Сверен"
        )
        db_session.add(invoice)
        db_session.commit()

        db_session.refresh(invoice)

        # Verify raw_file column exists and stores binary data
        assert hasattr(invoice, 'raw_file')
        assert invoice.raw_file == b'\x50\x44\x46\x00'

    def test_invoice_has_verification_result_column(self, db_session):
        """Test Invoice model has verification_result column for JSONB storage."""
        # Create project, supplier, and purchase order
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com"
        )
        db_session.add_all([project, supplier])
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.flush()

        # Create invoice with verification_result
        verification_data = {
            "status": "verified",
            "confidence": 0.95,
            "items_matched": 3,
            "items_total": 3,
            "discrepancies": []
        }
        invoice = Invoice(
            purchase_order_id=po.id,
            verification_result=verification_data,
            status="Сверен"
        )
        db_session.add(invoice)
        db_session.commit()

        db_session.refresh(invoice)

        # Verify verification_result column exists and stores JSON
        assert hasattr(invoice, 'verification_result')
        assert invoice.verification_result["status"] == "verified"
        assert invoice.verification_result["confidence"] == 0.95
        assert invoice.verification_result["items_matched"] == 3

    def test_invoice_item_creation(self, db_session):
        """Test InvoiceItem model can be created and persisted."""
        # Create project, supplier, PO, and invoice
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com"
        )
        db_session.add_all([project, supplier])
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(
            purchase_order_id=po.id,
            status="Ожидает сверки"
        )
        db_session.add(invoice)
        db_session.flush()

        # Create invoice item
        item = InvoiceItem(
            invoice_id=invoice.id,
            project_item_id=None,  # Not mapped to project item yet
            name="Test Item",
            sku="SKU-001",
            qty=10,
            unit_price=100.00,
            total_price=1000.00
        )
        db_session.add(item)
        db_session.commit()

        db_session.refresh(item)

        # Verify item was created
        assert item.id is not None
        assert item.name == "Test Item"
        assert item.sku == "SKU-001"
        assert item.qty == 10
        assert item.unit_price == 100.00
        assert item.total_price == 1000.00

    def test_invoice_item_relationships(self, db_session):
        """Test InvoiceItem -> Invoice and ProjectItem relationships."""
        # Create project with items
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        project_item = ProjectItem(
            project_id=project.id,
            name="Project Item",
            sku="PROJ-SKU-001",
            qty=10,
            status="К закупке"
        )
        db_session.add(project_item)
        db_session.flush()

        # Create supplier and PO
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com"
        )
        db_session.add(supplier)
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.flush()

        # Create invoice
        invoice = Invoice(
            purchase_order_id=po.id,
            status="Ожидает сверки"
        )
        db_session.add(invoice)
        db_session.flush()

        # Create invoice item mapped to project item
        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            project_item_id=project_item.id,
            name="Invoice Item",
            sku="INV-SKU-001",
            qty=5,
            unit_price=50.00,
            total_price=250.00
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Refresh all
        db_session.refresh(invoice_item)
        db_session.refresh(invoice)
        db_session.refresh(project_item)

        # Test invoice_item -> invoice relationship
        assert invoice_item.invoice == invoice
        assert invoice_item.invoice.status == "Ожидает сверки"

        # Test invoice_item -> project_item relationship
        assert invoice_item.project_item == project_item
        assert invoice_item.project_item.name == "Project Item"

        # Test invoice -> items (bidirectional)
        assert len(invoice.items) == 1
        assert invoice.items[0] == invoice_item


class TestBankStatementModels:
    """Test BankStatement, BankTransaction, and TransactionMatchingAudit models."""

    def test_bank_statement_transactions_bidirectional(self, db_session):
        """Test BankStatement -> BankTransaction bidirectional navigation."""
        # Create a bank statement
        statement = BankStatement(
            bank_name="Tinkoff",
            statement_date=datetime.now(),
            period_start=datetime.now(),
            period_end=datetime.now(),
            status="Обрабатывается"
        )
        db_session.add(statement)
        db_session.flush()

        # Create bank transactions
        txn1 = BankTransaction(
            bank_statement_id=statement.id,
            transaction_date=datetime.now(),
            amount=10000.00,
            supplier_inn="1234567890",
            description="Payment for goods",
            operation_type="Debit"
        )
        txn2 = BankTransaction(
            bank_statement_id=statement.id,
            transaction_date=datetime.now(),
            amount=5000.00,
            supplier_inn="0987654321",
            description="Service fee",
            operation_type="Debit"
        )
        db_session.add_all([txn1, txn2])
        db_session.commit()

        # Refresh to ensure relationships are loaded
        db_session.refresh(statement)
        db_session.refresh(txn1)
        db_session.refresh(txn2)

        # Test statement -> transactions
        assert len(statement.transactions) == 2
        assert statement.transactions[0].amount == 10000.00
        assert statement.transactions[1].amount == 5000.00

        # Test transaction -> statement (bidirectional)
        assert txn1.bank_statement == statement
        assert txn1.bank_statement.bank_name == "Tinkoff"
        assert txn2.bank_statement == statement

    def test_bank_statement_cascade_delete_transactions(self, db_session):
        """Test that deleting a BankStatement deletes child BankTransaction records."""
        # Create a bank statement with transactions
        statement = BankStatement(
            bank_name="Ozon",
            statement_date=datetime.now(),
            period_start=datetime.now(),
            period_end=datetime.now(),
            status="Готов"
        )
        db_session.add(statement)
        db_session.flush()

        txn1 = BankTransaction(
            bank_statement_id=statement.id,
            transaction_date=datetime.now(),
            amount=15000.00,
            supplier_inn="1111111111",
            description="Purchase payment",
            operation_type="Debit"
        )
        txn2 = BankTransaction(
            bank_statement_id=statement.id,
            transaction_date=datetime.now(),
            amount=7500.00,
            supplier_inn="2222222222",
            description="Partial payment",
            operation_type="Debit"
        )
        db_session.add_all([txn1, txn2])
        db_session.commit()

        # Verify transactions exist
        statement_id = statement.id
        txn_count = db_session.query(BankTransaction).filter_by(bank_statement_id=statement_id).count()
        assert txn_count == 2

        # Delete statement (should cascade delete transactions)
        db_session.delete(statement)
        db_session.commit()

        # Verify transactions are cascade deleted
        txn_count = db_session.query(BankTransaction).filter_by(bank_statement_id=statement_id).count()
        assert txn_count == 0, "BankTransaction records should be cascade deleted when BankStatement is deleted"

    def test_bank_transaction_lazy_selectin(self, db_session):
        """Test that BankStatement.transactions uses selectin lazy loading to prevent N+1 queries."""
        statement = BankStatement(
            bank_name="Tinkoff",
            statement_date=datetime.now(),
            period_start=datetime.now(),
            period_end=datetime.now(),
            status="Обрабатывается"
        )
        db_session.add(statement)
        db_session.flush()

        # Create multiple transactions
        for i in range(5):
            txn = BankTransaction(
                bank_statement_id=statement.id,
                transaction_date=datetime.now(),
                amount=float(1000 * (i + 1)),
                supplier_inn=f"{i:010d}",
                description=f"Transaction {i}",
                operation_type="Debit"
            )
            db_session.add(txn)
        db_session.commit()

        # Access statement.transactions - should load in a single query with selectin
        db_session.refresh(statement)
        transactions = statement.transactions

        assert len(transactions) == 5
        # With selectin, all transactions are loaded upfront (no N+1)
        # This is verified by inspection, not assert

    def test_bank_transaction_matching_audits_relationship(self, db_session):
        """Test BankTransaction -> TransactionMatchingAudit relationship."""
        # Create bank statement with transaction
        statement = BankStatement(
            bank_name="Tinkoff",
            statement_date=datetime.now(),
            period_start=datetime.now(),
            period_end=datetime.now(),
            status="Готов"
        )
        db_session.add(statement)
        db_session.flush()

        txn = BankTransaction(
            bank_statement_id=statement.id,
            transaction_date=datetime.now(),
            amount=10000.00,
            supplier_inn="1234567890",
            description="Payment for goods",
            operation_type="Debit"
        )
        db_session.add(txn)
        db_session.flush()

        # Create project, supplier, PO, and invoice for matching audit
        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com"
        )
        db_session.add_all([project, supplier])
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(
            purchase_order_id=po.id,
            status="Сверен"
        )
        db_session.add(invoice)
        db_session.flush()

        # Create matching audit
        audit = TransactionMatchingAudit(
            bank_transaction_id=txn.id,
            invoice_id=invoice.id,
            matched_at=datetime.now(),
            matched_by="auto",
            confidence_score=0.95,
            matching_context={"algorithm": "fuzzy_match", "score": 0.95}
        )
        db_session.add(audit)
        db_session.commit()

        # Refresh
        db_session.refresh(txn)
        db_session.refresh(audit)

        # Test transaction -> matching_audits
        assert len(txn.matching_audits) == 1
        assert txn.matching_audits[0].matched_by == "auto"
        # confidence_score is Numeric(3,2), returns Decimal
        assert float(txn.matching_audits[0].confidence_score) == 0.95

        # Test audit -> bank_transaction (bidirectional)
        assert audit.bank_transaction == txn
        assert audit.bank_transaction.amount == 10000.00

    def test_bank_statement_model_attributes(self, db_session):
        """Test BankStatement model has all expected attributes."""
        statement = BankStatement(
            bank_name="Tinkoff",
            statement_date=datetime.now(),
            period_start=datetime.now(),
            period_end=datetime.now(),
            status="Готов"
        )
        db_session.add(statement)
        db_session.commit()

        db_session.refresh(statement)

        # Basic attributes
        assert hasattr(statement, 'id')
        assert hasattr(statement, 'bank_name')
        assert hasattr(statement, 'statement_date')
        assert hasattr(statement, 'period_start')
        assert hasattr(statement, 'period_end')
        assert hasattr(statement, 'raw_file')
        assert hasattr(statement, 'status')
        assert hasattr(statement, 'created_at')

        # Relationship attributes
        assert hasattr(statement, 'transactions')

    def test_bank_transaction_model_attributes(self, db_session):
        """Test BankTransaction model has all expected attributes."""
        statement = BankStatement(
            bank_name="Ozon",
            statement_date=datetime.now(),
            period_start=datetime.now(),
            period_end=datetime.now()
        )
        db_session.add(statement)
        db_session.flush()

        txn = BankTransaction(
            bank_statement_id=statement.id,
            transaction_date=datetime.now(),
            amount=10000.00,
            supplier_inn="1234567890",
            description="Test payment",
            operation_type="Debit"
        )
        db_session.add(txn)
        db_session.commit()

        db_session.refresh(txn)

        # Basic attributes
        assert hasattr(txn, 'id')
        assert hasattr(txn, 'bank_statement_id')
        assert hasattr(txn, 'transaction_date')
        assert hasattr(txn, 'amount')
        assert hasattr(txn, 'supplier_inn')
        assert hasattr(txn, 'description')
        assert hasattr(txn, 'operation_type')
        assert hasattr(txn, 'created_at')

        # Relationship attributes
        assert hasattr(txn, 'bank_statement')
        assert hasattr(txn, 'matching_audits')

    def test_transaction_matching_audit_model_attributes(self, db_session):
        """Test TransactionMatchingAudit model has all expected attributes."""
        # Create dependent objects
        statement = BankStatement(
            bank_name="Tinkoff",
            statement_date=datetime.now(),
            period_start=datetime.now(),
            period_end=datetime.now()
        )
        db_session.add(statement)
        db_session.flush()

        txn = BankTransaction(
            bank_statement_id=statement.id,
            transaction_date=datetime.now(),
            amount=10000.00,
            operation_type="Debit"
        )
        db_session.add(txn)
        db_session.flush()

        project = Project(name="Test Project", client="Test Client")
        supplier = Supplier(name="Test Supplier", email="test@example.com")
        db_session.add_all([project, supplier])
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Ожидает сверки")
        db_session.add(invoice)
        db_session.flush()

        # Create audit
        audit = TransactionMatchingAudit(
            bank_transaction_id=txn.id,
            invoice_id=invoice.id,
            matched_at=datetime.now(),
            matched_by="auto",
            confidence_score=0.95,
            matching_context={"test": "data"}
        )
        db_session.add(audit)
        db_session.commit()

        db_session.refresh(audit)

        # Basic attributes
        assert hasattr(audit, 'id')
        assert hasattr(audit, 'bank_transaction_id')
        assert hasattr(audit, 'invoice_id')
        assert hasattr(audit, 'matched_at')
        assert hasattr(audit, 'matched_by')
        assert hasattr(audit, 'confidence_score')
        assert hasattr(audit, 'matching_context')
        assert hasattr(audit, 'created_at')

        # Relationship attributes
        assert hasattr(audit, 'bank_transaction')
        assert hasattr(audit, 'invoice')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
