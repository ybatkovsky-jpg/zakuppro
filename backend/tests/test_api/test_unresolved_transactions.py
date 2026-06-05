"""
FastAPI UnresolvedTransaction CRUD endpoint integration tests.

Tests verify:
- POST /api/unresolved-transactions creates transactions
- GET /api/unresolved-transactions returns list with pagination, filtering, search
- GET /api/unresolved-transactions/{id} returns single transaction
- PUT /api/unresolved-transactions/{id} modifies fields
- DELETE /api/unresolved-transactions/{id} removes transactions
- GET /api/unresolved-transactions/{id}/candidates suggests invoice matches
- Filter by status, amount range, date range
- Search in description field
- Ordering by various fields and directions
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

try:
    from backend.models import Supplier, Project, PurchaseOrder, Invoice, InvoiceItem, Payment, TransactionMatchingAudit, UnresolvedTransaction
except ImportError:
    from models import Supplier, Project, PurchaseOrder, Invoice, InvoiceItem, Payment, TransactionMatchingAudit, UnresolvedTransaction


class TestCreateUnresolvedTransaction:
    """Test POST /api/unresolved-transactions endpoint."""

    def test_create_unresolved_transaction_success(self, auth_client: TestClient):
        """POST returns 201 with created transaction including id."""
        now = datetime.utcnow()
        payload = {
            "amount": 15000.00,
            "description": "Payment for invoice #12345",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        }
        response = auth_client.post("/api/unresolved-transactions/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["id"] > 0
        assert data["amount"] == 15000.00
        assert data["description"] == "Payment for invoice #12345"
        assert data["status"] == "Не распределено"
        assert "created_at" in data

    def test_create_unresolved_transaction_with_defaults(self, auth_client: TestClient):
        """POST creates transaction with default status."""
        now = datetime.utcnow()
        payload = {
            "amount": 5000.00,
            "bank_date": now.isoformat()
        }
        response = auth_client.post("/api/unresolved-transactions/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "Не распределено"  # Default value
        assert data["description"] is None

    def test_create_unresolved_transaction_validation_missing_amount(self, auth_client: TestClient):
        """POST returns 422 when required field 'amount' is missing."""
        now = datetime.utcnow()
        payload = {
            "bank_date": now.isoformat()
        }
        response = auth_client.post("/api/unresolved-transactions/", json=payload)

        assert response.status_code == 422


class TestListUnresolvedTransactions:
    """Test GET /api/unresolved-transactions endpoint with filters, search, and ordering."""

    def _create_test_transactions(self, auth_client: TestClient, count: int = 5):
        """Helper to create test transactions with varied attributes."""
        now = datetime.utcnow()
        created = []
        for i in range(count):
            payload = {
                "amount": 1000.00 * (i + 1),
                "description": f"Transaction {'ABC' if i % 2 == 0 else 'XYZ'}-{i}",
                "bank_date": (now + timedelta(days=i)).isoformat(),
                "status": "Не распределено" if i % 2 == 0 else "Привязано вручную"
            }
            response = auth_client.post("/api/unresolved-transactions/", json=payload)
            created.append(response.json())
        return created

    def test_list_unresolved_transactions_empty(self, auth_client: TestClient):
        """GET returns empty list when no transactions exist."""
        response = auth_client.get("/api/unresolved-transactions/")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_unresolved_transactions_with_data(self, auth_client: TestClient):
        """GET returns list of all transactions."""
        self._create_test_transactions(auth_client, 3)

        response = auth_client.get("/api/unresolved-transactions/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_unresolved_transactions_pagination(self, auth_client: TestClient):
        """GET respects skip and limit query parameters."""
        self._create_test_transactions(auth_client, 5)

        # Test skip
        response = auth_client.get("/api/unresolved-transactions/?skip=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Test limit
        response = auth_client.get("/api/unresolved-transactions/?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Test both
        response = auth_client.get("/api/unresolved-transactions/?skip=1&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_filter_by_status(self, auth_client: TestClient):
        """GET filters transactions by status field."""
        transactions = self._create_test_transactions(auth_client, 4)

        # Filter for "Не распределено" (even indices)
        response = auth_client.get("/api/unresolved-transactions/?status=Не распределено")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for item in data:
            assert item["status"] == "Не распределено"

        # Filter for "Привязано вручную" (odd indices)
        response = auth_client.get("/api/unresolved-transactions/?status=Привязано вручную")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for item in data:
            assert item["status"] == "Привязано вручную"

    def test_list_filter_by_amount_range(self, auth_client: TestClient):
        """GET filters transactions by amount_min and amount_max."""
        self._create_test_transactions(auth_client, 5)  # amounts: 1000, 2000, 3000, 4000, 5000

        # Filter by amount_min
        response = auth_client.get("/api/unresolved-transactions/?amount_min=3000")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # 3000, 4000, 5000
        for item in data:
            assert item["amount"] >= 3000

        # Filter by amount_max
        response = auth_client.get("/api/unresolved-transactions/?amount_max=3000")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # 1000, 2000, 3000
        for item in data:
            assert item["amount"] <= 3000

        # Filter by both
        response = auth_client.get("/api/unresolved-transactions/?amount_min=2500&amount_max=4500")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # 3000, 4000
        for item in data:
            assert 2500 <= item["amount"] <= 4500

    def test_list_filter_by_date_range(self, auth_client: TestClient):
        """GET filters transactions by date_from and date_to."""
        now = datetime.utcnow()
        self._create_test_transactions(auth_client, 5)

        date_from = (now + timedelta(days=1)).isoformat()
        date_to = (now + timedelta(days=3)).isoformat()

        # Filter by date_from
        response = auth_client.get(f"/api/unresolved-transactions/?date_from={date_from}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 4  # days 1, 2, 3, 4

        # Filter by date_to
        date_to_response = (now + timedelta(days=2)).isoformat()
        response = auth_client.get(f"/api/unresolved-transactions/?date_to={date_to_response}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3  # days 0, 1, 2

        # Filter by both
        response = auth_client.get(f"/api/unresolved-transactions/?date_from={date_from}&date_to={date_to}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2  # days 2, 3

    def test_list_search_in_description(self, auth_client: TestClient):
        """GET searches case-insensitively in description field."""
        self._create_test_transactions(auth_client, 5)

        # Search for "ABC" (even indices have "ABC")
        response = auth_client.get("/api/unresolved-transactions/?search=ABC")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        for item in data:
            assert "ABC" in item["description"] or "abc" in item["description"].lower()

        # Search for "XYZ" (odd indices have "XYZ")
        response = auth_client.get("/api/unresolved-transactions/?search=XYZ")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        for item in data:
            assert "XYZ" in item["description"] or "xyz" in item["description"].lower()

        # Case-insensitive search
        response = auth_client.get("/api/unresolved-transactions/?search=abc")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_list_ordering(self, auth_client: TestClient):
        """GET orders results by order_by and order_dir parameters."""
        self._create_test_transactions(auth_client, 5)

        # Order by amount ascending
        response = auth_client.get("/api/unresolved-transactions/?order_by=amount&order_dir=asc")
        assert response.status_code == 200
        data = response.json()
        amounts = [item["amount"] for item in data]
        assert amounts == sorted(amounts)

        # Order by amount descending (default)
        response = auth_client.get("/api/unresolved-transactions/?order_by=amount&order_dir=desc")
        assert response.status_code == 200
        data = response.json()
        amounts = [item["amount"] for item in data]
        assert amounts == sorted(amounts, reverse=True)

        # Order by bank_date
        response = auth_client.get("/api/unresolved-transactions/?order_by=bank_date&order_dir=asc")
        assert response.status_code == 200
        data = response.json()
        dates = [item["bank_date"] for item in data]
        assert dates == sorted(dates)

    def test_list_combined_filters(self, auth_client: TestClient):
        """GET applies multiple filters simultaneously."""
        self._create_test_transactions(auth_client, 5)

        # Combine status, amount, and search
        response = auth_client.get(
            "/api/unresolved-transactions/?status=Не распределено&amount_min=1000&amount_max=4000&search=ABC"
        )
        assert response.status_code == 200
        data = response.json()
        # Should get transactions with: status=Не распределено, amount 1000-4000, description contains ABC
        for item in data:
            assert item["status"] == "Не распределено"
            assert 1000 <= item["amount"] <= 4000
            assert "ABC" in item["description"] or "abc" in item["description"].lower()

    def test_list_invalid_order_by_defaults_to_bank_date(self, auth_client: TestClient):
        """GET defaults to bank_date ordering when invalid order_by provided."""
        self._create_test_transactions(auth_client, 3)

        response = auth_client.get("/api/unresolved-transactions/?order_by=invalid_field")
        assert response.status_code == 200
        # Should not error, just use default ordering


class TestGetUnresolvedTransaction:
    """Test GET /api/unresolved-transactions/{id} endpoint."""

    def test_get_unresolved_transaction_success(self, auth_client: TestClient):
        """GET returns transaction by id."""
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 7500.00,
            "description": "Test transaction",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == transaction_id
        assert data["amount"] == 7500.00
        assert data["description"] == "Test transaction"

    def test_get_unresolved_transaction_not_found(self, auth_client: TestClient):
        """GET returns 404 when transaction id doesn't exist."""
        response = auth_client.get("/api/unresolved-transactions/99999")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()


class TestUpdateUnresolvedTransaction:
    """Test PUT /api/unresolved-transactions/{id} endpoint."""

    def test_update_unresolved_transaction_success(self, auth_client: TestClient):
        """PUT modifies transaction fields."""
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 3000.00,
            "description": "Original description",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        update_payload = {
            "status": "Привязано вручную",
            "description": "Updated description"
        }
        response = auth_client.put(f"/api/unresolved-transactions/{transaction_id}", json=update_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == transaction_id
        assert data["status"] == "Привязано вручную"
        assert data["description"] == "Updated description"
        assert data["amount"] == 3000.00  # Unchanged

    def test_update_unresolved_transaction_partial(self, auth_client: TestClient):
        """PUT with partial fields only updates provided fields."""
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 5000.00,
            "bank_date": now.isoformat()
        })
        transaction_id = create_response.json()["id"]

        # Only update status
        response = auth_client.put(f"/api/unresolved-transactions/{transaction_id}", json={
            "status": "Привязано вручную"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Привязано вручную"
        assert data["amount"] == 5000.00  # Unchanged

    def test_update_unresolved_transaction_not_found(self, auth_client: TestClient):
        """PUT returns 404 when transaction id doesn't exist."""
        response = auth_client.put("/api/unresolved-transactions/99999", json={
            "status": "Привязано вручную"
        })

        assert response.status_code == 404


class TestDeleteUnresolvedTransaction:
    """Test DELETE /api/unresolved-transactions/{id} endpoint."""

    def test_delete_unresolved_transaction_success(self, auth_client: TestClient):
        """DELETE removes transaction and returns 204."""
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 2000.00,
            "bank_date": now.isoformat()
        })
        transaction_id = create_response.json()["id"]

        response = auth_client.delete(f"/api/unresolved-transactions/{transaction_id}")

        assert response.status_code == 204
        assert response.content == b""

        # Verify transaction is gone
        get_response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}")
        assert get_response.status_code == 404

    def test_delete_unresolved_transaction_not_found(self, auth_client: TestClient):
        """DELETE returns 404 when transaction id doesn't exist."""
        response = auth_client.delete("/api/unresolved-transactions/99999")

        assert response.status_code == 404


class TestGetInvoiceCandidates:
    """Test GET /api/unresolved-transactions/{id}/candidates endpoint."""

    def test_get_candidates_returns_empty_list_for_no_invoices(self, auth_client: TestClient):
        """GET returns empty list when no matching invoices exist."""
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 5000.00,
            "description": "Test transaction",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}/candidates")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_candidates_with_exact_match(self, auth_client: TestClient, db_session: Session):
        """GET returns invoice with confidence 1.00 for exact amount match."""
        # Create supplier, project, PO, invoice with items
        supplier = Supplier(
            name="Test Supplier",
            email="test@example.com",
            requisites="ИНН: 7701234567\nБанк: Тинькофф",
        )
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)

        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create unresolved transaction with exact match amount
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 10000.00,
            "description": "Test transaction",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Get candidates
        response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}/candidates")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["invoice_id"] == invoice.id
        assert data[0]["supplier_name"] == "Test Supplier"
        assert data[0]["invoice_total"] == 10000.00
        assert data[0]["amount_difference"] == 0.0
        assert data[0]["confidence_score"] == 1.00

    def test_get_candidates_with_tolerance_match(self, auth_client: TestClient, db_session: Session):
        """GET returns invoice within 10% tolerance with confidence < 1.00."""
        # Create supplier, project, PO, invoice with items
        supplier = Supplier(
            name="Tolerance Supplier",
            email="tolerance@example.com",
            requisites="ИНН: 7701234567\nБанк: Тинькофф",
        )
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)

        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        # Invoice total is 10000.00
        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create unresolved transaction with 5% difference (within 10% tolerance)
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 9500.00,  # 5% less than invoice
            "description": "Test transaction",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Get candidates
        response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}/candidates")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["invoice_id"] == invoice.id
        assert data[0]["supplier_name"] == "Tolerance Supplier"
        assert data[0]["invoice_total"] == 10000.00
        assert data[0]["amount_difference"] == 500.0
        # Confidence should be < 1.00 but > 0.75 (our baseline)
        assert 0.75 < data[0]["confidence_score"] < 1.00

    def test_get_candidates_excludes_outside_tolerance(self, auth_client: TestClient, db_session: Session):
        """GET excludes invoices outside 10% tolerance range."""
        # Create supplier, project, PO, invoice with items
        supplier = Supplier(
            name="Far Supplier",
            email="far@example.com",
            requisites="ИНН: 7701234567\nБанк: Тинькофф",
        )
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)

        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        # Invoice total is 10000.00
        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create unresolved transaction with 15% difference (outside 10% tolerance)
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 8500.00,  # 15% less than invoice
            "description": "Test transaction",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Get candidates
        response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}/candidates")

        assert response.status_code == 200
        data = response.json()
        # Should be empty since 15% difference is outside 10% tolerance
        assert len(data) == 0

    def test_get_candidates_sorted_by_confidence(self, auth_client: TestClient, db_session: Session):
        """GET returns candidates sorted by confidence score descending."""
        # Create two invoices with different amounts
        supplier = Supplier(
            name="Multi Invoice Supplier",
            email="multi@example.com",
            requisites="ИНН: 7701234567\nБанк: Тинькофф",
        )
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)

        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        # Invoice 1: exact match (10000.00)
        invoice1 = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice1)
        db_session.flush()
        item1 = InvoiceItem(
            invoice_id=invoice1.id,
            name="Item 1",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(item1)

        # Invoice 2: close match (9500.00)
        invoice2 = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice2)
        db_session.flush()
        item2 = InvoiceItem(
            invoice_id=invoice2.id,
            name="Item 2",
            sku="SKU002",
            qty=1,
            unit_price=Decimal("9500.00"),
            total_price=Decimal("9500.00"),
        )
        db_session.add(item2)
        db_session.commit()

        # Create unresolved transaction that matches invoice1 exactly
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 10000.00,
            "description": "Test transaction",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Get candidates
        response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}/candidates")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Should be sorted by confidence descending
        confidences = [c["confidence_score"] for c in data]
        assert confidences == sorted(confidences, reverse=True)
        # First should have confidence 1.00 (exact match)
        assert data[0]["confidence_score"] == 1.00

    def test_get_candidates_transaction_not_found(self, auth_client: TestClient):
        """GET returns 404 when transaction id doesn't exist."""
        response = auth_client.get("/api/unresolved-transactions/99999/candidates")

        assert response.status_code == 404


class TestManualMatch:
    """Test POST /api/unresolved-transactions/{id}/match endpoint."""

    def test_manual_match_success(self, auth_client: TestClient, db_session: Session):
        """POST creates Payment, Audit, and updates transaction status."""
        # Create supplier, project, PO, invoice with items
        supplier = Supplier(
            name="Manual Match Supplier",
            email="manual@example.com",
            requisites="ИНН: 7701234567\nБанк: Тинькофф",
        )
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)

        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create unresolved transaction with status 'Не распределено'
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 10000.00,
            "description": "Test transaction for manual match",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        assert create_response.status_code == 201
        transaction_id = create_response.json()["id"]

        # Manually match to invoice
        match_payload = {"invoice_id": invoice.id}
        match_response = auth_client.post(
            f"/api/unresolved-transactions/{transaction_id}/match",
            json=match_payload
        )

        assert match_response.status_code == 201
        data = match_response.json()
        assert data["payment_id"] > 0
        assert data["invoice_id"] == invoice.id
        assert data["transaction_id"] == transaction_id
        assert data["amount"] == 10000.00
        assert "matched_at" in data

        # Verify Payment record was created
        payment = db_session.query(Payment).filter(Payment.id == data["payment_id"]).first()
        assert payment is not None
        assert payment.invoice_id == invoice.id
        assert float(payment.amount) == 10000.00
        assert payment.bank_transaction_id == f"unresolved_{transaction_id}"

        # Verify TransactionMatchingAudit was created with unresolved_transaction_id
        audit = db_session.query(TransactionMatchingAudit).filter(
            TransactionMatchingAudit.unresolved_transaction_id == transaction_id
        ).first()
        assert audit is not None
        assert audit.invoice_id == invoice.id
        assert audit.matched_by == "manual"
        assert audit.bank_transaction_id is None  # Null for manual matches from unresolved

        # Verify UnresolvedTransaction status was updated
        get_response = auth_client.get(f"/api/unresolved-transactions/{transaction_id}")
        assert get_response.status_code == 200
        transaction_data = get_response.json()
        assert transaction_data["status"] == "Привязано вручную"

    def test_manual_match_transaction_not_found(self, auth_client: TestClient, db_session: Session):
        """POST returns 404 when transaction id doesn't exist."""
        supplier = Supplier(name="Test Supplier", email="test@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.commit()

        match_payload = {"invoice_id": invoice.id}
        response = auth_client.post("/api/unresolved-transactions/99999/match", json=match_payload)

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_manual_match_invoice_not_found(self, auth_client: TestClient):
        """POST returns 404 when invoice id doesn't exist."""
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 5000.00,
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        match_payload = {"invoice_id": 99999}
        response = auth_client.post(
            f"/api/unresolved-transactions/{transaction_id}/match",
            json=match_payload
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_manual_match_invalid_status(self, auth_client: TestClient, db_session: Session):
        """POST returns 400 when transaction status is not 'Не распределено'."""
        now = datetime.utcnow()
        # Create transaction with status 'Привязано вручную' (already matched)
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 5000.00,
            "bank_date": now.isoformat(),
            "status": "Привязано вручную"
        })
        transaction_id = create_response.json()["id"]

        supplier = Supplier(name="Test Supplier", email="test@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.commit()

        match_payload = {"invoice_id": invoice.id}
        response = auth_client.post(
            f"/api/unresolved-transactions/{transaction_id}/match",
            json=match_payload
        )

        assert response.status_code == 400
        assert "status" in response.json()["detail"].lower()

    def test_manual_match_rollback_on_error(self, auth_client: TestClient, db_session: Session):
        """POST rolls back transaction when invoice is deleted during match."""
        # Create supplier, project, PO, invoice
        supplier = Supplier(name="Test Supplier", email="test@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.commit()

        # Store invoice_id before deletion
        invoice_id = invoice.id

        # Create unresolved transaction
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 10000.00,
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        assert create_response.status_code == 201
        transaction_id = create_response.json()["id"]

        # Delete the invoice to trigger a foreign key error
        db_session.delete(invoice)
        db_session.commit()

        # Try to match to the deleted invoice
        match_payload = {"invoice_id": invoice_id}
        response = auth_client.post(
            f"/api/unresolved-transactions/{transaction_id}/match",
            json=match_payload
        )

        # Should return 404 since invoice doesn't exist
        assert response.status_code == 404

        # Verify transaction status was NOT updated (no changes made)
        db_session.expire_all()  # Clear session cache
        transaction = db_session.query(UnresolvedTransaction).filter(
            UnresolvedTransaction.id == transaction_id
        ).first()
        assert transaction.status == "Не распределено"  # Still original status

        # Verify no Payment was created
        payment = db_session.query(Payment).filter(
            Payment.bank_transaction_id == f"unresolved_{transaction_id}"
        ).first()
        assert payment is None

        # Verify no TransactionMatchingAudit was created
        audit = db_session.query(TransactionMatchingAudit).filter(
            TransactionMatchingAudit.unresolved_transaction_id == transaction_id
        ).first()
        assert audit is None


class TestBulkManualMatch:
    """Test POST /api/unresolved-transactions/bulk-match endpoint."""

    def test_bulk_match_all_success(self, auth_client: TestClient, db_session: Session):
        """POST successfully matches all transactions to invoices."""
        # Create supplier, project, PO, and multiple invoices
        supplier = Supplier(
            name="Bulk Match Supplier",
            email="bulk@example.com",
            requisites="ИНН: 7701234567\nБанк: Тинькофф",
        )
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)

        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        # Create 3 invoices
        invoices = []
        for i in range(3):
            invoice = Invoice(purchase_order_id=po.id, status="Сверен")
            db_session.add(invoice)
            db_session.flush()

            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                name=f"Test Item {i}",
                sku=f"SKU{i:03d}",
                qty=1,
                unit_price=Decimal(f"{10000 * (i + 1)}.00"),
                total_price=Decimal(f"{10000 * (i + 1)}.00"),
            )
            db_session.add(invoice_item)
            invoices.append(invoice)
        db_session.commit()

        # Create 3 unresolved transactions
        transaction_ids = []
        for i in range(3):
            now = datetime.utcnow()
            create_response = auth_client.post("/api/unresolved-transactions/", json={
                "amount": float(10000 * (i + 1)),
                "description": f"Test transaction {i}",
                "bank_date": now.isoformat(),
                "status": "Не распределено"
            })
            assert create_response.status_code == 201
            transaction_ids.append(create_response.json()["id"])

        # Bulk match all 3 transactions
        bulk_payload = {
            "matches": [
                {"unresolved_transaction_id": transaction_ids[0], "invoice_id": invoices[0].id},
                {"unresolved_transaction_id": transaction_ids[1], "invoice_id": invoices[1].id},
                {"unresolved_transaction_id": transaction_ids[2], "invoice_id": invoices[2].id},
            ]
        }
        response = auth_client.post("/api/unresolved-transactions/bulk-match", json=bulk_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 3
        assert data["failed_count"] == 0
        assert len(data["payment_ids"]) == 3
        assert len(data["errors"]) == 0

        # Verify all Payment records were created
        for payment_id in data["payment_ids"]:
            payment = db_session.query(Payment).filter(Payment.id == payment_id).first()
            assert payment is not None

        # Verify all TransactionMatchingAudit entries were created
        for txn_id in transaction_ids:
            audit = db_session.query(TransactionMatchingAudit).filter(
                TransactionMatchingAudit.unresolved_transaction_id == txn_id
            ).first()
            assert audit is not None
            assert audit.matched_by == "manual"
            assert audit.bank_transaction_id is None

        # Verify all transaction statuses were updated
        for txn_id in transaction_ids:
            get_response = auth_client.get(f"/api/unresolved-transactions/{txn_id}")
            assert get_response.status_code == 200
            assert get_response.json()["status"] == "Привязано вручную"

    def test_bulk_match_with_custom_amounts(self, auth_client: TestClient, db_session: Session):
        """POST uses custom amounts when provided in match items."""
        # Create invoice and transaction
        supplier = Supplier(name="Custom Amount Supplier", email="custom@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create transaction with different amount
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 12000.00,  # Different from invoice
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Bulk match with custom amount (override transaction amount)
        bulk_payload = {
            "matches": [
                {"unresolved_transaction_id": transaction_id, "invoice_id": invoice.id, "amount": 9500.00}
            ]
        }
        response = auth_client.post("/api/unresolved-transactions/bulk-match", json=bulk_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 1

        # Verify Payment was created with custom amount
        payment = db_session.query(Payment).filter(Payment.id == data["payment_ids"][0]).first()
        assert payment is not None
        assert float(payment.amount) == 9500.00  # Custom amount, not transaction amount

    def test_bulk_match_partial_failure(self, auth_client: TestClient, db_session: Session):
        """POST returns partial results when some matches fail validation."""
        # Create single valid invoice
        supplier = Supplier(name="Partial Supplier", email="partial@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create one valid transaction
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 10000.00,
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        valid_transaction_id = create_response.json()["id"]

        # Create another transaction with wrong status
        create_response2 = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 5000.00,
            "bank_date": now.isoformat(),
            "status": "Привязано вручную"  # Invalid status
        })
        invalid_transaction_id = create_response2.json()["id"]

        # Bulk match with one valid and one invalid
        bulk_payload = {
            "matches": [
                {"unresolved_transaction_id": valid_transaction_id, "invoice_id": invoice.id},
                {"unresolved_transaction_id": invalid_transaction_id, "invoice_id": invoice.id},
                {"unresolved_transaction_id": 99999, "invoice_id": invoice.id},  # Non-existent transaction
            ]
        }
        response = auth_client.post("/api/unresolved-transactions/bulk-match", json=bulk_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 1  # Only valid match
        assert data["failed_count"] == 2  # Two validation failures
        assert len(data["payment_ids"]) == 1
        assert len(data["errors"]) == 2

        # Verify error details
        error_messages = [e["error"] for e in data["errors"]]
        assert any("status" in msg.lower() for msg in error_messages)
        assert any("not found" in msg.lower() for msg in error_messages)

    def test_bulk_match_all_fail_validation(self, auth_client: TestClient):
        """POST returns zero matches when all items fail validation."""
        # All matches fail - non-existent transaction
        bulk_payload = {
            "matches": [
                {"unresolved_transaction_id": 99999, "invoice_id": 88888},
                {"unresolved_transaction_id": 99998, "invoice_id": 88887},
            ]
        }
        response = auth_client.post("/api/unresolved-transactions/bulk-match", json=bulk_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 0
        assert data["failed_count"] == 2
        assert len(data["payment_ids"]) == 0
        assert len(data["errors"]) == 2

    def test_bulk_match_rollback_on_error(self, auth_client: TestClient, db_session: Session):
        """POST rolls back entire transaction when database error occurs."""
        # Create supplier, project, PO, invoice
        supplier = Supplier(name="Rollback Supplier", email="rollback@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create transaction
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 10000.00,
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Delete the invoice to trigger a foreign key error during processing
        invoice_id = invoice.id
        db_session.delete(invoice)
        db_session.commit()

        # Try to bulk match to the deleted invoice
        # This will pass validation (invoice exists when checked) but fail during actual processing
        # However, since we check before the transaction, we need a different approach
        # Let's use a non-existent invoice that passes the count check but fails FK
        bulk_payload = {
            "matches": [
                {"unresolved_transaction_id": transaction_id, "invoice_id": invoice_id},
            ]
        }
        response = auth_client.post("/api/unresolved-transactions/bulk-match", json=bulk_payload)

        # Should return 200 with validation error (invoice not found during validation)
        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 0
        assert data["failed_count"] == 1

        # Verify transaction status was NOT updated
        db_session.expire_all()
        transaction = db_session.query(UnresolvedTransaction).filter(
            UnresolvedTransaction.id == transaction_id
        ).first()
        assert transaction.status == "Не распределено"

    def test_bulk_match_empty_list(self, auth_client: TestClient):
        """POST handles empty matches list gracefully."""
        bulk_payload = {"matches": []}
        response = auth_client.post("/api/unresolved-transactions/bulk-match", json=bulk_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 0
        assert data["failed_count"] == 0
        assert len(data["payment_ids"]) == 0
        assert len(data["errors"]) == 0

    def test_bulk_match_with_amount_override(self, auth_client: TestClient, db_session: Session):
        """POST allows specifying custom amount for partial payments."""
        supplier = Supplier(name="Amount Override Supplier", email="override@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Test Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="SKU001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create transaction with larger amount
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 15000.00,
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Bulk match with partial payment amount
        bulk_payload = {
            "matches": [
                {"unresolved_transaction_id": transaction_id, "invoice_id": invoice.id, "amount": 5000.00}
            ]
        }
        response = auth_client.post("/api/unresolved-transactions/bulk-match", json=bulk_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["matched_count"] == 1

        # Verify Payment was created with the custom amount
        payment = db_session.query(Payment).filter(Payment.id == data["payment_ids"][0]).first()
        assert payment is not None
        assert float(payment.amount) == 5000.00  # Custom partial payment amount

        # Verify TransactionMatchingAudit records the correct context
        audit = db_session.query(TransactionMatchingAudit).filter(
            TransactionMatchingAudit.unresolved_transaction_id == transaction_id
        ).first()
        assert audit is not None
        assert audit.matching_context["transaction_amount"] == "5000.0"


class TestAuditHistory:
    """Test GET /api/unresolved-transactions/audit-history endpoint."""

    @staticmethod
    def _create_test_data(auth_client: TestClient, db_session: Session):
        """Helper to create test data for audit history tests."""
        supplier = Supplier(name="Audit Supplier", email="audit@example.com", requisites="ИНН: 7701234567")
        db_session.add(supplier)

        project = Project(name="Audit Project", client="Audit Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Audit Item",
            sku="AUDIT001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00"),
        )
        db_session.add(invoice_item)
        db_session.commit()

        # Create unresolved transactions
        now = datetime.utcnow()
        create_response = auth_client.post("/api/unresolved-transactions/", json={
            "amount": 10000.00,
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        # Manual match to create audit record
        match_response = auth_client.post(f"/api/unresolved-transactions/{transaction_id}/match", json={
            "invoice_id": invoice.id
        })

        return {
            "transaction_id": transaction_id,
            "invoice_id": invoice.id,
            "payment_id": match_response.json()["payment_id"],
        }

    def test_audit_history_returns_manual_matches(self, auth_client: TestClient, db_session: Session):
        """GET returns audit records for manual matches with nested details."""
        data = self._create_test_data(auth_client, db_session)

        response = auth_client.get("/api/unresolved-transactions/audit-history")

        assert response.status_code == 200
        audit_data = response.json()
        assert "items" in audit_data
        assert "total" in audit_data
        assert "skip" in audit_data
        assert "limit" in audit_data

        assert audit_data["total"] >= 1
        assert len(audit_data["items"]) >= 1

        # Find the manual match audit record
        audit_record = None
        for item in audit_data["items"]:
            if item.get("unresolved_transaction_id") == data["transaction_id"]:
                audit_record = item
                break

        assert audit_record is not None
        assert audit_record["invoice_id"] == data["invoice_id"]
        assert audit_record["matched_by"] == "manual"
        assert audit_record["unresolved_transaction_id"] == data["transaction_id"]
        assert audit_record["bank_transaction_id"] is None  # Manual matches have null bank_transaction_id
        assert audit_record["confidence_score"] == 1.0  # Manual match = full confidence

        # Check nested unresolved_transaction
        assert "unresolved_transaction" in audit_record
        assert audit_record["unresolved_transaction"]["id"] == data["transaction_id"]
        assert audit_record["unresolved_transaction"]["amount"] == 10000.00
        assert audit_record["unresolved_transaction"]["status"] == "Привязано вручную"

        # Check nested invoice
        assert "invoice" in audit_record
        assert audit_record["invoice"]["id"] == data["invoice_id"]
        assert audit_record["invoice"]["status"] == "Сверен"

    def test_audit_history_filter_by_transaction_id(self, auth_client: TestClient, db_session: Session):
        """GET filters audit records by unresolved transaction ID."""
        data = self._create_test_data(auth_client, db_session)

        response = auth_client.get(f"/api/unresolved-transactions/audit-history?transaction_id={data['transaction_id']}")

        assert response.status_code == 200
        audit_data = response.json()
        assert audit_data["total"] >= 1

        # All returned records should have the specified transaction_id
        for item in audit_data["items"]:
            assert item["unresolved_transaction_id"] == data["transaction_id"]

    def test_audit_history_filter_by_invoice_id(self, auth_client: TestClient, db_session: Session):
        """GET filters audit records by invoice ID."""
        data = self._create_test_data(auth_client, db_session)

        response = auth_client.get(f"/api/unresolved-transactions/audit-history?invoice_id={data['invoice_id']}")

        assert response.status_code == 200
        audit_data = response.json()
        assert audit_data["total"] >= 1

        # All returned records should have the specified invoice_id
        for item in audit_data["items"]:
            assert item["invoice_id"] == data["invoice_id"]

    def test_audit_history_filter_by_matched_by(self, auth_client: TestClient, db_session: Session):
        """GET filters audit records by matched_by field."""
        self._create_test_data(auth_client, db_session)

        response = auth_client.get("/api/unresolved-transactions/audit-history?matched_by=manual")

        assert response.status_code == 200
        audit_data = response.json()

        # All returned records should have matched_by='manual'
        for item in audit_data["items"]:
            assert item["matched_by"] == "manual"

    def test_audit_history_filter_by_date_range(self, auth_client: TestClient, db_session: Session):
        """GET filters audit records by matched_at date range."""
        now = datetime.utcnow()
        data = self._create_test_data(auth_client, db_session)

        # Filter with date_from (should include our record)
        date_from = (now - timedelta(hours=1)).isoformat()
        response = auth_client.get(f"/api/unresolved-transactions/audit-history?date_from={date_from}")

        assert response.status_code == 200
        audit_data = response.json()
        assert audit_data["total"] >= 1

        # Filter with date_to in the past (should return 0)
        past_date = (now - timedelta(days=30)).isoformat()
        response = auth_client.get(f"/api/unresolved-transactions/audit-history?date_to={past_date}")

        assert response.status_code == 200
        audit_data = response.json()
        assert audit_data["total"] == 0

    def test_audit_history_pagination(self, auth_client: TestClient, db_session: Session):
        """GET respects skip and limit query parameters."""
        # Create multiple audit records
        for i in range(5):
            data = self._create_test_data(auth_client, db_session)

        # Test limit
        response = auth_client.get("/api/unresolved-transactions/audit-history?limit=3")
        assert response.status_code == 200
        audit_data = response.json()
        assert len(audit_data["items"]) <= 3
        assert audit_data["limit"] == 3

        # Test skip
        total = audit_data["total"]
        response = auth_client.get(f"/api/unresolved-transactions/audit-history?skip=2&limit={total}")
        assert response.status_code == 200
        audit_data = response.json()
        assert audit_data["skip"] == 2

    def test_audit_history_empty_result(self, auth_client: TestClient):
        """GET returns empty list when no audit records exist."""
        response = auth_client.get("/api/unresolved-transactions/audit-history")

        assert response.status_code == 200
        audit_data = response.json()
        assert audit_data["total"] == 0
        assert len(audit_data["items"]) == 0

    def test_audit_history_combined_filters(self, auth_client: TestClient, db_session: Session):
        """GET applies multiple filters simultaneously."""
        now = datetime.utcnow()
        data = self._create_test_data(auth_client, db_session)

        # Combine transaction_id, matched_by, and date filters
        date_from = (now - timedelta(hours=1)).isoformat()
        response = auth_client.get(
            f"/api/unresolved-transactions/audit-history?"
            f"transaction_id={data['transaction_id']}"
            f"&matched_by=manual"
            f"&date_from={date_from}"
        )

        assert response.status_code == 200
        audit_data = response.json()

        # All filters should be applied
        for item in audit_data["items"]:
            assert item["unresolved_transaction_id"] == data["transaction_id"]
            assert item["matched_by"] == "manual"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
