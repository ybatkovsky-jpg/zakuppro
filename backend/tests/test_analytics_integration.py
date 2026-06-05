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
        UnresolvedTransaction, Role
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

    def test_dashboard_metrics_e2e(self, auth_client, db_session: Session):
        """Create invoices with varying statuses, create payments, verify dashboard counts match."""
        from fastapi.testclient import TestClient
        now = datetime.utcnow()

        # Create supplier and project via API
        supplier_resp = auth_client.post("/api/suppliers/", json={
            "name": "Integration Supplier", "email": "integration@example.com"
        })
        supplier_id = supplier_resp.json()["id"]

        project_resp = auth_client.post("/api/projects/", json={
            "name": "Integration Project", "client": "Test Client"
        })
        project_id = project_resp.json()["id"]

        po_resp = auth_client.post("/api/purchase-orders/", json={
            "project_id": project_id, "supplier_id": supplier_id, "status": "Сверен"
        })
        po_id = po_resp.json()["id"]

        # Create invoices with different statuses
        paid_invoice_resp = auth_client.post("/api/invoices/", json={
            "purchase_order_id": po_id, "status": "Оплачен"
        })
        paid_invoice_id = paid_invoice_resp.json()["id"]

        # Add items to paid invoice
        auth_client.post("/api/invoice-items/", json={
            "invoice_id": paid_invoice_id,
            "name": "Paid Item", "sku": "PAID-001", "qty": 10,
            "unit_price": 1000.00, "total_price": 10000.00
        })

        # Create payment for paid invoice
        auth_client.post("/api/payments/", json={
            "invoice_id": paid_invoice_id,
            "amount": 10000.00,
            "payment_date": (now - timedelta(days=3)).isoformat(),
            "bank_transaction_id": "TXN-001"
        })

        # Unpaid invoices
        for status in ["Ожидает сверки", "Ожидает оплаты", "Ошибки"]:
            inv_resp = auth_client.post("/api/invoices/", json={
                "purchase_order_id": po_id, "status": status
            })
            inv_id = inv_resp.json()["id"]
            auth_client.post("/api/invoice-items/", json={
                "invoice_id": inv_id,
                "name": f"Unpaid Item {status}", "sku": f"UNPAID-{status[:3]}", "qty": 1,
                "unit_price": 10000.00, "total_price": 10000.00
            })

        # Pending invoice (Сверен)
        pending_resp = auth_client.post("/api/invoices/", json={
            "purchase_order_id": po_id, "status": "Сверен"
        })
        pending_id = pending_resp.json()["id"]
        auth_client.post("/api/invoice-items/", json={
            "invoice_id": pending_id,
            "name": "Pending Item", "sku": "PENDING-001", "qty": 1,
            "unit_price": 5000.00, "total_price": 5000.00
        })

        # Now verify dashboard metrics via HTTP
        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = auth_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["paid_invoices_count"] == 1
        assert data["unpaid_invoices_count"] == 3
        assert data["pending_invoices_count"] == 1
        assert data["total_paid_amount"] == 10000.0


class TestPaymentDynamicsE2E:
    """Test end-to-end payment dynamics with date range and grouping."""

    def test_payment_dynamics_e2e(self, auth_client, db_session: Session):
        """Create payments across date range, call dynamics endpoint, verify grouping works."""
        now = datetime.utcnow()

        # Create supplier, project, PO via API
        supplier_resp = auth_client.post("/api/suppliers/", json={
            "name": "Dynamics Supplier", "email": "dynamics@example.com"
        })
        supplier_id = supplier_resp.json()["id"]

        project_resp = auth_client.post("/api/projects/", json={
            "name": "Dynamics Project", "client": "Test Client"
        })
        project_id = project_resp.json()["id"]

        po_resp = auth_client.post("/api/purchase-orders/", json={
            "project_id": project_id, "supplier_id": supplier_id, "status": "Сверен"
        })
        po_id = po_resp.json()["id"]

        # Create invoice
        inv_resp = auth_client.post("/api/invoices/", json={
            "purchase_order_id": po_id, "status": "Оплачен"
        })
        invoice_id = inv_resp.json()["id"]

        # Create payments across different days
        payment_dates = [
            now - timedelta(days=10),
            now - timedelta(days=10),
            now - timedelta(days=5),
            now - timedelta(days=2),
        ]
        payment_amounts = [5000.0, 3000.0, 7000.0, 12000.0]

        for date, amount in zip(payment_dates, payment_amounts):
            auth_client.post("/api/payments/", json={
                "invoice_id": invoice_id,
                "amount": amount,
                "payment_date": date.isoformat(),
                "bank_transaction_id": f"TXN-{date.strftime('%Y%m%d')}"
            })

        # Test day grouping via HTTP
        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = auth_client.get(
            f"/api/analytics/payment-dynamics?period_start={period_start}&period_end={period_end}&group_by=day"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 4
        assert data["total_amount"] == 27000.0
        assert len(data["data"]) == 3  # 3 unique days


class TestExportDownloadE2E:
    """Test end-to-end Excel export with data integrity verification."""

    def test_export_download_e2e(self, auth_client, db_session: Session):
        """Create payments, call export endpoint, parse .xlsx with pandas, verify integrity."""
        now = datetime.utcnow()

        # Create supplier and project via API
        supplier_resp = auth_client.post("/api/suppliers/", json={
            "name": "Export Supplier", "email": "export@example.com"
        })
        supplier_id = supplier_resp.json()["id"]

        project_resp = auth_client.post("/api/projects/", json={
            "name": "Export Project", "client": "Test Client"
        })
        project_id = project_resp.json()["id"]

        po_resp = auth_client.post("/api/purchase-orders/", json={
            "project_id": project_id, "supplier_id": supplier_id, "status": "Сверен"
        })
        po_id = po_resp.json()["id"]

        # Create invoice with items
        inv_resp = auth_client.post("/api/invoices/", json={
            "purchase_order_id": po_id, "status": "Оплачен"
        })
        invoice_id = inv_resp.json()["id"]

        auth_client.post("/api/invoice-items/", json={
            "invoice_id": invoice_id,
            "name": "Export Item", "sku": "EXPORT-001", "qty": 10,
            "unit_price": 1000.00, "total_price": 10000.00
        })

        # Create multiple payments
        payments_data = [
            (now - timedelta(days=5), 10000.0),
            (now - timedelta(days=3), 5000.0),
            (now - timedelta(days=1), 15000.0),
        ]

        for date, amount in payments_data:
            auth_client.post("/api/payments/", json={
                "invoice_id": invoice_id,
                "amount": amount,
                "payment_date": date.isoformat(),
                "bank_transaction_id": f"TXN-{date.strftime('%Y%m%d')}"
            })

        # Call export endpoint via HTTP
        response = auth_client.get("/api/analytics/export/transactions")

        # Verify response is a valid Excel file
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        # Parse Excel with pandas
        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, engine="openpyxl")

        # Verify row count
        assert len(df) == 3

        # Verify data integrity
        assert df["amount"].sum() == 30000.0  # 10000 + 5000 + 15000


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
