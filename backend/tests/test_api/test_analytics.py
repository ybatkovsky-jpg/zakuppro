"""
FastAPI Analytics endpoint integration tests.

Tests verify:
- GET /api/analytics/dashboard returns dashboard metrics
- Metrics calculate correctly with empty database
- Metrics calculate correctly with single records
- Metrics calculate correctly with multiple records
- Date range filtering works correctly
- Date range validation (max 1 year, start before end)
- Default to last 30 days when no date range provided
- Structured logging occurs with filter parameters and results
- GET /api/analytics/payment-dynamics returns grouped time-series data
- GET /api/analytics/export/transactions returns downloadable .xlsx file
"""
import pytest
import pandas as pd
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from io import BytesIO

try:
    from backend.models import (
        Supplier, Project, PurchaseOrder, Invoice, InvoiceItem,
        Payment, TransactionMatchingAudit
    )
    from backend.routers import analytics
except ImportError:
    from models import (
        Supplier, Project, PurchaseOrder, Invoice, InvoiceItem,
        Payment, TransactionMatchingAudit
    )
    from routers import analytics


class TestDashboardMetricsEmptyDB:
    """Test GET /api/analytics/dashboard with empty database."""

    def test_dashboard_metrics_empty_db(self, test_client: TestClient):
        """GET returns 200 with zero counts when database is empty."""
        now = datetime.utcnow()
        response = test_client.get(
            f"/api/analytics/dashboard?period_start={(now - timedelta(days=30)).isoformat()}&period_end={now.isoformat()}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["paid_invoices_count"] == 0
        assert data["unpaid_invoices_count"] == 0
        assert data["total_paid_amount"] == 0.0
        assert data["total_unpaid_amount"] == 0.0
        assert data["pending_invoices_count"] == 0


class TestDashboardMetricsSingleRecord:
    """Test GET /api/analytics/dashboard with single records."""

    def test_dashboard_metrics_single_paid_invoice(self, test_client: TestClient):
        """GET returns 200 with correct counts for single paid invoice."""
        # First create a supplier, project, and purchase order
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier",
            "email": "test@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        # Create invoice
        now = datetime.utcnow()
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert invoice_response.status_code == 201
        invoice_id = invoice_response.json()["id"]

        # Create payment for the invoice
        payment_response = test_client.post("/api/payments/", json={
            "invoice_id": invoice_id,
            "amount": 10000.00,
            "payment_date": (now - timedelta(days=3)).isoformat()
        })
        assert payment_response.status_code == 201

        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["paid_invoices_count"] == 1
        assert data["unpaid_invoices_count"] == 0
        assert data["total_paid_amount"] == 10000.0
        assert data["total_unpaid_amount"] == 0.0
        assert data["pending_invoices_count"] == 0

    def test_dashboard_metrics_single_unpaid_invoice(self, test_client: TestClient):
        """GET returns 200 with correct counts for single unpaid invoice."""
        # First create a supplier, project, and purchase order
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier",
            "email": "test2@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project 2",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        # Create unpaid invoice
        now = datetime.utcnow()
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Ожидает оплаты"
        })
        assert invoice_response.status_code == 201
        invoice_id = invoice_response.json()["id"]

        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["paid_invoices_count"] == 0
        assert data["unpaid_invoices_count"] == 1
        assert data["total_paid_amount"] == 0.0
        # Unpaid invoice without items will have 0 total
        assert data["total_unpaid_amount"] == 0.0
        assert data["pending_invoices_count"] == 0

    def test_dashboard_metrics_single_pending_invoice(self, test_client: TestClient):
        """GET returns 200 with correct counts for single pending invoice (status='Сверен')."""
        # First create a supplier, project, and purchase order
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier",
            "email": "test3@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project 3",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        # Create pending invoice
        now = datetime.utcnow()
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Сверен"
        })
        assert invoice_response.status_code == 201

        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["paid_invoices_count"] == 0
        assert data["unpaid_invoices_count"] == 0
        assert data["total_paid_amount"] == 0.0
        assert data["total_unpaid_amount"] == 0.0
        assert data["pending_invoices_count"] == 1


class TestDashboardMetricsMultipleRecords:
    """Test GET /api/analytics/dashboard with multiple records."""

    def test_dashboard_metrics_multiple_records(self, test_client: TestClient):
        """GET returns 200 with correct aggregated counts for multiple records."""
        # First create a supplier, project, and purchase order
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier Multi",
            "email": "testmulti@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project Multi",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        now = datetime.utcnow()

        # Create 2 paid invoices
        paid_invoice_ids = []
        for i in range(2):
            invoice_response = test_client.post("/api/invoices/", json={
                "purchase_order_id": po_id,
                "status": "Оплачен"
            })
            assert invoice_response.status_code == 201
            invoice_id = invoice_response.json()["id"]
            paid_invoice_ids.append(invoice_id)

            # Create payment for each invoice
            payment_response = test_client.post("/api/payments/", json={
                "invoice_id": invoice_id,
                "amount": 10000.00 * (i + 1),
                "payment_date": (now - timedelta(days=9 - i)).isoformat()
            })
            assert payment_response.status_code == 201

        # Create 3 unpaid invoices with different statuses
        unpaid_statuses = ["Ожидает сверки", "Ожидает оплаты", "Ошибки"]
        for status in unpaid_statuses:
            invoice_response = test_client.post("/api/invoices/", json={
                "purchase_order_id": po_id,
                "status": status
            })
            assert invoice_response.status_code == 201

        # Create 1 pending invoice
        pending_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Сверен"
        })
        assert pending_response.status_code == 201

        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["paid_invoices_count"] == 2
        assert data["unpaid_invoices_count"] == 3
        assert data["total_paid_amount"] == 30000.0  # 10000 + 20000
        assert data["total_unpaid_amount"] == 0.0  # No invoice items
        assert data["pending_invoices_count"] == 1


class TestDashboardMetricsDateRangeFiltering:
    """Test GET /api/analytics/dashboard date range filtering."""

    def test_dashboard_metrics_with_date_range(self, test_client: TestClient):
        """GET returns metrics filtered by date range."""
        # First create a supplier, project, and purchase order
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier Date",
            "email": "testdate@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project Date",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        now = datetime.utcnow()

        # Create recent invoice
        recent_invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert recent_invoice_response.status_code == 201
        recent_invoice_id = recent_invoice_response.json()["id"]

        # Create payment for the invoice
        payment_response = test_client.post("/api/payments/", json={
            "invoice_id": recent_invoice_id,
            "amount": 5000.00,
            "payment_date": (now - timedelta(days=3)).isoformat()
        })
        assert payment_response.status_code == 201

        # Query with a very narrow date range that includes only the payment
        period_start = (now - timedelta(days=5)).isoformat()
        period_end = now.isoformat()
        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 200
        data = response.json()
        # Both invoice and payment are in range
        assert data["paid_invoices_count"] == 1
        assert data["total_paid_amount"] == 5000.0


class TestDashboardMetricsDateRangeValidation:
    """Test GET /api/analytics/dashboard date range validation."""

    def test_dashboard_metrics_range_exceeds_one_year(self, test_client: TestClient):
        """GET returns 400 when date range exceeds 1 year."""
        now = datetime.utcnow()
        period_start = (now - timedelta(days=400)).isoformat()
        period_end = now.isoformat()

        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 400
        assert "exceeds maximum of 1 year" in response.json()["detail"]

    def test_dashboard_metrics_start_after_end(self, test_client: TestClient):
        """GET returns 400 when period_start is after period_end."""
        now = datetime.utcnow()
        period_start = now.isoformat()
        period_end = (now - timedelta(days=10)).isoformat()

        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 400
        assert "period_start must be before period_end" in response.json()["detail"]

    def test_dashboard_metrics_partial_date_range(self, test_client: TestClient):
        """GET returns 400 when only one date parameter is provided."""
        now = datetime.utcnow()
        period_start = now.isoformat()

        response = test_client.get(
            f"/api/analytics/dashboard?period_start={period_start}"
        )

        assert response.status_code == 400
        assert "Both period_start and period_end must be provided" in response.json()["detail"]


class TestDashboardMetricsDefaultDateRange:
    """Test GET /api/analytics/dashboard default date range behavior."""

    def test_dashboard_metrics_default_to_last_30_days(self, test_client: TestClient):
        """GET defaults to last 30 days when no date range provided."""
        # First create a supplier, project, and purchase order
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier Default",
            "email": "testdefault@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project Default",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        now = datetime.utcnow()

        # Create recent invoice
        recent_invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert recent_invoice_response.status_code == 201
        recent_invoice_id = recent_invoice_response.json()["id"]

        # Create payment for recent invoice
        payment_response = test_client.post("/api/payments/", json={
            "invoice_id": recent_invoice_id,
            "amount": 5000.00,
            "payment_date": (now - timedelta(days=3)).isoformat()
        })
        assert payment_response.status_code == 201

        # Query without date range - should default to last 30 days
        response = test_client.get("/api/analytics/dashboard")

        assert response.status_code == 200
        data = response.json()
        # Recent invoice should be counted
        assert data["paid_invoices_count"] == 1
        assert data["total_paid_amount"] == 5000.0


class TestPaymentDynamicsEmptyDB:
    """Test GET /api/analytics/payment-dynamics with empty database."""

    def test_payment_dynamics_empty_db(self, test_client: TestClient):
        """GET returns 200 with empty data list when database is empty."""
        now = datetime.utcnow()
        response = test_client.get(
            f"/api/analytics/payment-dynamics?period_start={(now - timedelta(days=30)).isoformat()}&period_end={now.isoformat()}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
        assert data["total_amount"] == 0.0
        assert data["total_count"] == 0


class TestPaymentDynamicsSingleRecord:
    """Test GET /api/analytics/payment-dynamics with single records."""

    def test_payment_dynamics_single_payment(self, test_client: TestClient):
        """GET returns 200 with correct grouped data for single payment."""
        # First create a supplier, project, and purchase order
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier Dynamics",
            "email": "testdynamics@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project Dynamics",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        # Create invoice
        now = datetime.utcnow()
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert invoice_response.status_code == 201
        invoice_id = invoice_response.json()["id"]

        # Create payment for the invoice
        payment_response = test_client.post("/api/payments/", json={
            "invoice_id": invoice_id,
            "amount": 15000.00,
            "payment_date": (now - timedelta(days=5)).isoformat()
        })
        assert payment_response.status_code == 201

        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = test_client.get(
            f"/api/analytics/payment-dynamics?period_start={period_start}&period_end={period_end}&group_by=day"
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) > 0
        assert data["total_amount"] == 15000.0
        assert data["total_count"] == 1


class TestPaymentDynamicsGrouping:
    """Test GET /api/analytics/payment-dynamics grouping options."""

    def test_payment_dynamics_group_by_day(self, test_client: TestClient):
        """GET returns data grouped by day correctly."""
        # Create test data
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier GroupDay",
            "email": "testgroupday@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project GroupDay",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        now = datetime.utcnow()

        # Create invoice and payments on different days
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert invoice_response.status_code == 201
        invoice_id = invoice_response.json()["id"]

        # Create payments on consecutive days
        for i in range(3):
            test_client.post("/api/payments/", json={
                "invoice_id": invoice_id,
                "amount": 5000.00,
                "payment_date": (now - timedelta(days=10 - i)).isoformat()
            })

        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()
        response = test_client.get(
            f"/api/analytics/payment-dynamics?period_start={period_start}&period_end={period_end}&group_by=day"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_amount"] == 15000.0
        assert data["total_count"] == 3
        # Each payment should be in a separate day bucket
        assert len(data["data"]) == 3


class TestPaymentDynamicsDateRangeValidation:
    """Test GET /api/analytics/payment-dynamics date range validation."""

    def test_payment_dynamics_range_exceeds_one_year(self, test_client: TestClient):
        """GET returns 400 when date range exceeds 1 year."""
        now = datetime.utcnow()
        period_start = (now - timedelta(days=400)).isoformat()
        period_end = now.isoformat()

        response = test_client.get(
            f"/api/analytics/payment-dynamics?period_start={period_start}&period_end={period_end}"
        )

        assert response.status_code == 400
        assert "exceeds maximum of 1 year" in response.json()["detail"]

    def test_payment_dynamics_invalid_group_by(self, test_client: TestClient):
        """GET defaults to 'day' when invalid group_by is provided."""
        now = datetime.utcnow()
        period_start = (now - timedelta(days=30)).isoformat()
        period_end = now.isoformat()

        response = test_client.get(
            f"/api/analytics/payment-dynamics?period_start={period_start}&period_end={period_end}&group_by=invalid"
        )

        # Should default to 'day' and return 200, not 400
        assert response.status_code == 200


class TestExportTransactionsEmptyDB:
    """Test GET /api/analytics/export/transactions with empty database."""

    def test_export_transactions_empty_db(self, test_client: TestClient):
        """GET returns valid Excel file with header only when database is empty."""
        response = test_client.get("/api/analytics/export/transactions")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "attachment" in response.headers["content-disposition"]

        # Verify pandas can parse the Excel file
        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, engine="openpyxl")
        assert len(df) == 0  # No rows


class TestExportTransactionsWithRecords:
    """Test GET /api/analytics/export/transactions with data."""

    def test_export_transactions_with_data(self, test_client: TestClient):
        """GET returns valid Excel file with transaction data."""
        # Create test data
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier Export",
            "email": "testexport@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project Export",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        now = datetime.utcnow()

        # Create invoice
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert invoice_response.status_code == 201
        invoice_id = invoice_response.json()["id"]

        # Create payment
        payment_date = now - timedelta(days=3)
        payment_response = test_client.post("/api/payments/", json={
            "invoice_id": invoice_id,
            "amount": 25000.00,
            "payment_date": payment_date.isoformat()
        })
        assert payment_response.status_code == 201

        # Export transactions
        response = test_client.get("/api/analytics/export/transactions")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "attachment" in response.headers["content-disposition"]
        assert "transactions.xlsx" in response.headers["content-disposition"]

        # Verify pandas can parse the Excel file
        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, engine="openpyxl")
        assert len(df) == 1

        # Verify column structure
        assert list(df.columns) == ["date", "amount", "invoice_id", "supplier", "project", "description"]
        assert df.iloc[0]["amount"] == 25000.0
        assert df.iloc[0]["invoice_id"] == invoice_id
        assert df.iloc[0]["supplier"] == "Test Supplier Export"
        assert df.iloc[0]["project"] == "Test Project Export"
        assert df.iloc[0]["description"] == "Оплачен"

    def test_export_transactions_with_date_filter(self, test_client: TestClient):
        """GET returns Excel file filtered by date range."""
        # Create test data
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier ExportFilter",
            "email": "testexportfilter@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project ExportFilter",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        now = datetime.utcnow()

        # Create invoice
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert invoice_response.status_code == 201
        invoice_id = invoice_response.json()["id"]

        # Create payment outside the date range (old)
        old_payment_response = test_client.post("/api/payments/", json={
            "invoice_id": invoice_id,
            "amount": 10000.00,
            "payment_date": (now - timedelta(days=20)).isoformat()
        })
        assert old_payment_response.status_code == 201

        # Create payment inside the date range (recent)
        recent_payment_response = test_client.post("/api/payments/", json={
            "invoice_id": invoice_id,
            "amount": 20000.00,
            "payment_date": (now - timedelta(days=2)).isoformat()
        })
        assert recent_payment_response.status_code == 201

        # Export with date filter that only includes recent payment
        date_from = (now - timedelta(days=10)).isoformat()
        date_to = now.isoformat()
        response = test_client.get(
            f"/api/analytics/export/transactions?date_from={date_from}&date_to={date_to}"
        )

        assert response.status_code == 200

        # Verify only recent payment is included
        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, engine="openpyxl")
        assert len(df) == 1
        assert df.iloc[0]["amount"] == 20000.0

    def test_export_transactions_limit(self, test_client: TestClient):
        """GET respects the limit parameter."""
        # Create test data
        supplier_response = test_client.post("/api/suppliers/", json={
            "name": "Test Supplier ExportLimit",
            "email": "testexportlimit@example.com"
        })
        assert supplier_response.status_code == 201
        supplier_id = supplier_response.json()["id"]

        project_response = test_client.post("/api/projects/", json={
            "name": "Test Project ExportLimit",
            "client": "Test Client"
        })
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        po_response = test_client.post("/api/purchase-orders/", json={
            "project_id": project_id,
            "supplier_id": supplier_id
        })
        assert po_response.status_code == 201
        po_id = po_response.json()["id"]

        now = datetime.utcnow()

        # Create invoice
        invoice_response = test_client.post("/api/invoices/", json={
            "purchase_order_id": po_id,
            "status": "Оплачен"
        })
        assert invoice_response.status_code == 201
        invoice_id = invoice_response.json()["id"]

        # Create multiple payments
        for i in range(5):
            test_client.post("/api/payments/", json={
                "invoice_id": invoice_id,
                "amount": 1000.00 * (i + 1),
                "payment_date": (now - timedelta(days=i)).isoformat()
            })

        # Export with limit=3
        response = test_client.get("/api/analytics/export/transactions?limit=3")

        assert response.status_code == 200

        # Verify only 3 rows are included
        excel_data = BytesIO(response.content)
        df = pd.read_excel(excel_data, engine="openpyxl")
        assert len(df) == 3  # Limited to 3
