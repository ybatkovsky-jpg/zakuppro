"""
Integration tests for analytics/export/upload end-to-end workflow.

Tests verify the complete workflow from data creation through analytics queries,
export download, and upload/parsing to ensure all components work together.

Coverage:
- Dashboard metrics with real data
- Payment dynamics time-series with grouping
- Excel export with data integrity verification
- Bank statement upload and parsing
- Upload with auto-matching to invoices
- Audit trail creation verification
"""
import pytest
import pandas as pd
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from io import BytesIO
import os

try:
    from backend.models import (
        Supplier, Project, PurchaseOrder, Invoice, InvoiceItem,
        Payment, BankStatement, BankTransaction, TransactionMatchingAudit,
        UnresolvedTransaction
    )
    from backend.services.bank_statement_parser import BankStatementParser
    from backend.services.payment_matcher import PaymentMatcher
except ImportError:
    from models import (
        Supplier, Project, PurchaseOrder, Invoice, InvoiceItem,
        Payment, BankStatement, BankTransaction, TransactionMatchingAudit,
        UnresolvedTransaction
    )
    from services.bank_statement_parser import BankStatementParser
    from services.payment_matcher import PaymentMatcher


# Import path to fixture files
FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
TINKOFF_STATEMENT_PATH = os.path.join(FIXTURES_DIR, "tinkoff_statement.txt")


class TestDashboardMetricsE2E:
    """Test end-to-end dashboard metrics with varying invoice statuses and payments."""

    def test_dashboard_metrics_e2e(self, db_session: Session):
        """Create invoices with varying statuses, create payments, verify dashboard counts match."""
        now = datetime.utcnow()

        # Create supplier and project
        supplier = Supplier(name="Integration Supplier", email="integration@example.com")
        db_session.add(supplier)
        db_session.flush()

        project = Project(name="Integration Project", client="Test Client")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        # Create invoices with different statuses
        # Paid invoice with items and payment
        paid_invoice = Invoice(purchase_order_id=po.id, status="Оплачен", created_at=now - timedelta(days=5))
        db_session.add(paid_invoice)
        db_session.flush()

        # Add items to paid invoice
        paid_item = InvoiceItem(
            invoice_id=paid_invoice.id,
            name="Paid Item",
            sku="PAID-001",
            qty=10,
            unit_price=Decimal("1000.00"),
            total_price=Decimal("10000.00")
        )
        db_session.add(paid_item)

        # Create payment for paid invoice
        paid_payment = Payment(
            invoice_id=paid_invoice.id,
            amount=Decimal("10000.00"),
            payment_date=now - timedelta(days=3),
            bank_transaction_id="TXN-001"
        )
        db_session.add(paid_payment)

        # Unpaid invoice (Ожидает сверки) with items
        unpaid_invoice1 = Invoice(purchase_order_id=po.id, status="Ожидает сверки", created_at=now - timedelta(days=2))
        db_session.add(unpaid_invoice1)
        db_session.flush()

        unpaid_item1 = InvoiceItem(
            invoice_id=unpaid_invoice1.id,
            name="Unpaid Item 1",
            sku="UNPAID-001",
            qty=5,
            unit_price=Decimal("2000.00"),
            total_price=Decimal("10000.00")
        )
        db_session.add(unpaid_item1)

        # Unpaid invoice (Ожидает оплаты) with items
        unpaid_invoice2 = Invoice(purchase_order_id=po.id, status="Ожидает оплаты", created_at=now - timedelta(days=1))
        db_session.add(unpaid_invoice2)
        db_session.flush()

        unpaid_item2 = InvoiceItem(
            invoice_id=unpaid_invoice2.id,
            name="Unpaid Item 2",
            sku="UNPAID-002",
            qty=3,
            unit_price=Decimal("5000.00"),
            total_price=Decimal("15000.00")
        )
        db_session.add(unpaid_item2)

        # Unpaid invoice (Ошибки) with items
        unpaid_invoice3 = Invoice(purchase_order_id=po.id, status="Ошибки", created_at=now)
        db_session.add(unpaid_invoice3)
        db_session.flush()

        unpaid_item3 = InvoiceItem(
            invoice_id=unpaid_invoice3.id,
            name="Unpaid Item 3",
            sku="UNPAID-003",
            qty=2,
            unit_price=Decimal("7500.00"),
            total_price=Decimal("15000.00")
        )
        db_session.add(unpaid_item3)

        # Pending invoice (Сверен) with items
        pending_invoice = Invoice(purchase_order_id=po.id, status="Сверен", created_at=now)
        db_session.add(pending_invoice)
        db_session.flush()

        pending_item = InvoiceItem(
            invoice_id=pending_invoice.id,
            name="Pending Item",
            sku="PENDING-001",
            qty=1,
            unit_price=Decimal("5000.00"),
            total_price=Decimal("5000.00")
        )
        db_session.add(pending_item)

        db_session.commit()

        # Now verify dashboard metrics
        from backend.routers.analytics import get_dashboard_metrics

        period_start = now - timedelta(days=30)
        period_end = now

        metrics = get_dashboard_metrics(
            period_start=period_start,
            period_end=period_end,
            db=db_session
        )

        # Verify counts match our created data
        assert metrics.paid_invoices_count == 1
        assert metrics.unpaid_invoices_count == 3  # Ожидает сверки + Ожидает оплаты + Ошибки
        assert metrics.pending_invoices_count == 1  # Сверен

        # Verify amounts
        assert metrics.total_paid_amount == 10000.0
        assert metrics.total_unpaid_amount == 40000.0  # 10000 + 15000 + 15000


class TestPaymentDynamicsE2E:
    """Test end-to-end payment dynamics with date range and grouping."""

    def test_payment_dynamics_e2e(self, db_session: Session):
        """Create payments across date range, call dynamics endpoint, verify grouping works."""
        now = datetime.utcnow()

        # Create supplier, project, PO
        supplier = Supplier(name="Dynamics Supplier", email="dynamics@example.com")
        db_session.add(supplier)
        db_session.flush()

        project = Project(name="Dynamics Project", client="Test Client")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        # Create invoice
        invoice = Invoice(purchase_order_id=po.id, status="Оплачен", created_at=now - timedelta(days=10))
        db_session.add(invoice)
        db_session.flush()

        # Create payments across different days
        payment_dates = [
            now - timedelta(days=10),  # Day 1: 5000
            now - timedelta(days=10),  # Day 1: 3000 (same day)
            now - timedelta(days=5),   # Day 2: 7000
            now - timedelta(days=2),   # Day 3: 12000
        ]
        payment_amounts = [5000.0, 3000.0, 7000.0, 12000.0]

        for date, amount in zip(payment_dates, payment_amounts):
            payment = Payment(
                invoice_id=invoice.id,
                amount=Decimal(str(amount)),
                payment_date=date,
                bank_transaction_id=f"TXN-{date.strftime('%Y%m%d')}"
            )
            db_session.add(payment)

        db_session.commit()

        # Test day grouping
        from backend.routers.analytics import get_payment_dynamics

        period_start = now - timedelta(days=30)
        period_end = now

        dynamics = get_payment_dynamics(
            period_start=period_start,
            period_end=period_end,
            group_by="day",
            db=db_session
        )

        assert dynamics.total_count == 4
        assert dynamics.total_amount == 27000.0  # Sum of all payments
        assert len(dynamics.data) == 3  # 3 unique days

        # Verify data points
        amounts_by_date = {dp.date.date(): dp.paid_amount for dp in dynamics.data}
        assert amounts_by_date[(now - timedelta(days=10)).date()] == 8000.0  # 5000 + 3000
        assert amounts_by_date[(now - timedelta(days=5)).date()] == 7000.0
        assert amounts_by_date[(now - timedelta(days=2)).date()] == 12000.0


class TestExportDownloadE2E:
    """Test end-to-end Excel export with data integrity verification."""

    def test_export_download_e2e(self, db_session: Session):
        """Create payments, call export endpoint, parse .xlsx with pandas, verify integrity."""
        now = datetime.utcnow()

        # Create supplier and project
        supplier = Supplier(name="Export Supplier", email="export@example.com")
        db_session.add(supplier)
        db_session.flush()

        project = Project(name="Export Project", client="Test Client")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        # Create invoice with items
        invoice = Invoice(purchase_order_id=po.id, status="Оплачен", created_at=now - timedelta(days=5))
        db_session.add(invoice)
        db_session.flush()

        item = InvoiceItem(
            invoice_id=invoice.id,
            name="Export Item",
            sku="EXPORT-001",
            qty=10,
            unit_price=Decimal("1000.00"),
            total_price=Decimal("10000.00")
        )
        db_session.add(item)

        # Create multiple payments
        payments_data = [
            (now - timedelta(days=5), 10000.0),
            (now - timedelta(days=3), 5000.0),
            (now - timedelta(days=1), 15000.0),
        ]

        for date, amount in payments_data:
            payment = Payment(
                invoice_id=invoice.id,
                amount=Decimal(str(amount)),
                payment_date=date,
                bank_transaction_id=f"TXN-{date.strftime('%Y%m%d')}"
            )
            db_session.add(payment)

        db_session.commit()

        # Call export endpoint
        from backend.routers.analytics import export_transactions_excel
        from fastapi.responses import Response

        response = export_transactions_excel(
            date_from=now - timedelta(days=30),
            date_to=now,
            limit=1000,
            db=db_session
        )

        # Verify response is a valid Excel file
        assert isinstance(response, Response)
        assert response.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        # Parse Excel with pandas
        excel_data = BytesIO(response.body)
        df = pd.read_excel(excel_data, engine="openpyxl")

        # Verify row count
        assert len(df) == 3

        # Verify columns
        expected_columns = ["date", "amount", "invoice_id", "supplier", "project", "description"]
        assert list(df.columns) == expected_columns

        # Verify data integrity
        assert df["amount"].sum() == 30000.0  # 10000 + 5000 + 15000
        assert df["supplier"].iloc[0] == "Export Supplier"
        assert df["project"].iloc[0] == "Export Project"
        assert df["invoice_id"].iloc[0] == invoice.id
        assert df["description"].iloc[0] == "Оплачен"


class TestUploadAndParseE2E:
    """Test end-to-end bank statement upload and parsing."""

    def test_upload_and_parse_e2e(self, db_session: Session):
        """Upload test 1C ClientBank .txt file, verify BankStatement/BankTransaction records created."""
        # Read the fixture file
        with open(TINKOFF_STATEMENT_PATH, "rb") as f:
            file_content = f.read()

        # Parse the file
        parser = BankStatementParser()
        parse_result = parser.parse(file_content)

        # Verify parse result
        assert parse_result["bank_name"] == "ТИНЬКОФФ БАНК"
        assert len(parse_result["transactions"]) == 3

        # Create BankStatement record
        bank_statement = BankStatement(
            bank_name=parse_result["bank_name"],
            statement_date=parse_result["statement_date"],
            period_start=parse_result["period_start"],
            period_end=parse_result["period_end"],
            raw_file=file_content,
            status="Готов"
        )
        db_session.add(bank_statement)
        db_session.flush()

        # Create BankTransaction records
        transaction_count = 0
        for tx_data in parse_result["transactions"]:
            transaction = BankTransaction(
                bank_statement_id=bank_statement.id,
                transaction_date=tx_data["transaction_date"],
                amount=tx_data["amount"],
                supplier_inn=tx_data["supplier_inn"],
                description=tx_data["description"],
                operation_type=tx_data["operation_type"]
            )
            db_session.add(transaction)
            transaction_count += 1

        db_session.commit()

        # Verify records created
        assert bank_statement.id is not None
        assert transaction_count == 3

        # Verify BankTransactions in DB
        db_transactions = db_session.query(BankTransaction).filter(
            BankTransaction.bank_statement_id == bank_statement.id
        ).all()

        assert len(db_transactions) == 3

        # Verify transaction details
        # First transaction: ИП Иванов Иван Иванович, INN 123456789012, 150000.00
        tx1 = db_transactions[0]
        assert tx1.supplier_inn == "123456789012"
        assert float(tx1.amount) == 150000.0

        # Verify bank statement metadata
        assert bank_statement.bank_name == "ТИНЬКОФФ БАНК"
        assert bank_statement.status == "Готов"


class TestUploadWithMatchingE2E:
    """Test end-to-end upload with auto-matching to invoices."""

    def test_upload_with_matching_e2e(self, db_session: Session):
        """Upload statement, verify auto-matching creates Payment or UnresolvedTransaction."""
        now = datetime.utcnow()

        # Create supplier with matching INN (123456789012 from fixture)
        supplier = Supplier(
            name="ИП Иванов Иван Иванович",
            email="ivanov@example.com",
            requisites="ИНН 123456789012\n其他的供应商信息"
        )
        db_session.add(supplier)
        db_session.flush()

        # Create project and PO
        project = Project(name="Matching Project", client="Test Client")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сверен"
        )
        db_session.add(po)
        db_session.flush()

        # Create invoice with matching amount (150000.00 from fixture transaction)
        invoice = Invoice(
            purchase_order_id=po.id,
            status="Сверен",
            created_at=now - timedelta(days=5)
        )
        db_session.add(invoice)
        db_session.flush()

        # Add invoice item with matching total
        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Matching Item",
            sku="MATCH-001",
            qty=10,
            unit_price=Decimal("15000.00"),
            total_price=Decimal("150000.00")
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Read and parse the fixture file
        with open(TINKOFF_STATEMENT_PATH, "rb") as f:
            file_content = f.read()

        parser = BankStatementParser()
        parse_result = parser.parse(file_content)

        # Create BankStatement and BankTransaction records
        bank_statement = BankStatement(
            bank_name=parse_result["bank_name"],
            statement_date=parse_result["statement_date"],
            period_start=parse_result["period_start"],
            period_end=parse_result["period_end"],
            raw_file=file_content,
            status="Готов"
        )
        db_session.add(bank_statement)
        db_session.flush()

        # Create all 3 transactions from the fixture
        for tx_data in parse_result["transactions"]:
            transaction = BankTransaction(
                bank_statement_id=bank_statement.id,
                transaction_date=tx_data["transaction_date"],
                amount=tx_data["amount"],
                supplier_inn=tx_data["supplier_inn"],
                description=tx_data["description"],
                operation_type=tx_data["operation_type"]
            )
            db_session.add(transaction)
        db_session.commit()
        db_session.flush()

        # Run auto-matching
        matcher = PaymentMatcher(db_session)
        match_result = matcher.match_statement_transactions(bank_statement.id)

        # Verify matching result
        assert match_result.matched_count == 1
        assert match_result.unresolved_count == 2  # Other 2 transactions don't match

        # Get the first transaction (the one that should match)
        first_transaction = db_session.query(BankTransaction).filter(
            BankTransaction.bank_statement_id == bank_statement.id
        ).order_by(BankTransaction.id).first()

        # Verify Payment record created for the first transaction
        payments = db_session.query(Payment).filter(
            Payment.bank_transaction_id == str(first_transaction.id)
        ).all()

        assert len(payments) == 1
        assert float(payments[0].amount) == 150000.0
        assert payments[0].invoice_id == invoice.id

        # Verify invoice status updated to "Оплачен"
        db_session.refresh(invoice)
        assert invoice.status == "Оплачен"

        # Verify TransactionMatchingAudit record created
        audits = db_session.query(TransactionMatchingAudit).filter(
            TransactionMatchingAudit.bank_transaction_id == first_transaction.id
        ).all()

        assert len(audits) == 1
        assert audits[0].matched_by == "auto"
        assert audits[0].invoice_id == invoice.id
        assert float(audits[0].confidence_score) >= 0.85

        # Verify matching context contains audit trail
        assert audits[0].matching_context is not None
        context = audits[0].matching_context
        assert context["algorithm"] == "inn_tolerance_match"
        assert context["supplier_inn"] == "123456789012"
        assert context["confidence_score"] is not None

        # Verify UnresolvedTransaction created for non-matching transactions
        unresolved_count = db_session.query(UnresolvedTransaction).count()
        assert unresolved_count == 2
