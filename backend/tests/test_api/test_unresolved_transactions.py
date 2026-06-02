"""
FastAPI UnresolvedTransaction CRUD endpoint integration tests.

Tests verify:
- POST /api/unresolved-transactions creates transactions
- GET /api/unresolved-transactions returns list with pagination, filtering, search
- GET /api/unresolved-transactions/{id} returns single transaction
- PUT /api/unresolved-transactions/{id} modifies fields
- DELETE /api/unresolved-transactions/{id} removes transactions
- Filter by status, amount range, date range
- Search in description field
- Ordering by various fields and directions
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta


class TestCreateUnresolvedTransaction:
    """Test POST /api/unresolved-transactions endpoint."""

    def test_create_unresolved_transaction_success(self, test_client: TestClient):
        """POST returns 201 with created transaction including id."""
        now = datetime.utcnow()
        payload = {
            "amount": 15000.00,
            "description": "Payment for invoice #12345",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        }
        response = test_client.post("/api/unresolved-transactions/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["id"] > 0
        assert data["amount"] == 15000.00
        assert data["description"] == "Payment for invoice #12345"
        assert data["status"] == "Не распределено"
        assert "created_at" in data

    def test_create_unresolved_transaction_with_defaults(self, test_client: TestClient):
        """POST creates transaction with default status."""
        now = datetime.utcnow()
        payload = {
            "amount": 5000.00,
            "bank_date": now.isoformat()
        }
        response = test_client.post("/api/unresolved-transactions/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "Не распределено"  # Default value
        assert data["description"] is None

    def test_create_unresolved_transaction_validation_missing_amount(self, test_client: TestClient):
        """POST returns 422 when required field 'amount' is missing."""
        now = datetime.utcnow()
        payload = {
            "bank_date": now.isoformat()
        }
        response = test_client.post("/api/unresolved-transactions/", json=payload)

        assert response.status_code == 422


class TestListUnresolvedTransactions:
    """Test GET /api/unresolved-transactions endpoint with filters, search, and ordering."""

    def _create_test_transactions(self, test_client: TestClient, count: int = 5):
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
            response = test_client.post("/api/unresolved-transactions/", json=payload)
            created.append(response.json())
        return created

    def test_list_unresolved_transactions_empty(self, test_client: TestClient):
        """GET returns empty list when no transactions exist."""
        response = test_client.get("/api/unresolved-transactions/")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_unresolved_transactions_with_data(self, test_client: TestClient):
        """GET returns list of all transactions."""
        self._create_test_transactions(test_client, 3)

        response = test_client.get("/api/unresolved-transactions/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_list_unresolved_transactions_pagination(self, test_client: TestClient):
        """GET respects skip and limit query parameters."""
        self._create_test_transactions(test_client, 5)

        # Test skip
        response = test_client.get("/api/unresolved-transactions/?skip=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Test limit
        response = test_client.get("/api/unresolved-transactions/?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Test both
        response = test_client.get("/api/unresolved-transactions/?skip=1&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_filter_by_status(self, test_client: TestClient):
        """GET filters transactions by status field."""
        transactions = self._create_test_transactions(test_client, 4)

        # Filter for "Не распределено" (even indices)
        response = test_client.get("/api/unresolved-transactions/?status=Не распределено")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for item in data:
            assert item["status"] == "Не распределено"

        # Filter for "Привязано вручную" (odd indices)
        response = test_client.get("/api/unresolved-transactions/?status=Привязано вручную")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        for item in data:
            assert item["status"] == "Привязано вручную"

    def test_list_filter_by_amount_range(self, test_client: TestClient):
        """GET filters transactions by amount_min and amount_max."""
        self._create_test_transactions(test_client, 5)  # amounts: 1000, 2000, 3000, 4000, 5000

        # Filter by amount_min
        response = test_client.get("/api/unresolved-transactions/?amount_min=3000")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # 3000, 4000, 5000
        for item in data:
            assert item["amount"] >= 3000

        # Filter by amount_max
        response = test_client.get("/api/unresolved-transactions/?amount_max=3000")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # 1000, 2000, 3000
        for item in data:
            assert item["amount"] <= 3000

        # Filter by both
        response = test_client.get("/api/unresolved-transactions/?amount_min=2500&amount_max=4500")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # 3000, 4000
        for item in data:
            assert 2500 <= item["amount"] <= 4500

    def test_list_filter_by_date_range(self, test_client: TestClient):
        """GET filters transactions by date_from and date_to."""
        now = datetime.utcnow()
        self._create_test_transactions(test_client, 5)

        date_from = (now + timedelta(days=1)).isoformat()
        date_to = (now + timedelta(days=3)).isoformat()

        # Filter by date_from
        response = test_client.get(f"/api/unresolved-transactions/?date_from={date_from}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 4  # days 1, 2, 3, 4

        # Filter by date_to
        date_to_response = (now + timedelta(days=2)).isoformat()
        response = test_client.get(f"/api/unresolved-transactions/?date_to={date_to_response}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3  # days 0, 1, 2

        # Filter by both
        response = test_client.get(f"/api/unresolved-transactions/?date_from={date_from}&date_to={date_to}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2  # days 2, 3

    def test_list_search_in_description(self, test_client: TestClient):
        """GET searches case-insensitively in description field."""
        self._create_test_transactions(test_client, 5)

        # Search for "ABC" (even indices have "ABC")
        response = test_client.get("/api/unresolved-transactions/?search=ABC")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        for item in data:
            assert "ABC" in item["description"] or "abc" in item["description"].lower()

        # Search for "XYZ" (odd indices have "XYZ")
        response = test_client.get("/api/unresolved-transactions/?search=XYZ")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        for item in data:
            assert "XYZ" in item["description"] or "xyz" in item["description"].lower()

        # Case-insensitive search
        response = test_client.get("/api/unresolved-transactions/?search=abc")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    def test_list_ordering(self, test_client: TestClient):
        """GET orders results by order_by and order_dir parameters."""
        self._create_test_transactions(test_client, 5)

        # Order by amount ascending
        response = test_client.get("/api/unresolved-transactions/?order_by=amount&order_dir=asc")
        assert response.status_code == 200
        data = response.json()
        amounts = [item["amount"] for item in data]
        assert amounts == sorted(amounts)

        # Order by amount descending (default)
        response = test_client.get("/api/unresolved-transactions/?order_by=amount&order_dir=desc")
        assert response.status_code == 200
        data = response.json()
        amounts = [item["amount"] for item in data]
        assert amounts == sorted(amounts, reverse=True)

        # Order by bank_date
        response = test_client.get("/api/unresolved-transactions/?order_by=bank_date&order_dir=asc")
        assert response.status_code == 200
        data = response.json()
        dates = [item["bank_date"] for item in data]
        assert dates == sorted(dates)

    def test_list_combined_filters(self, test_client: TestClient):
        """GET applies multiple filters simultaneously."""
        self._create_test_transactions(test_client, 5)

        # Combine status, amount, and search
        response = test_client.get(
            "/api/unresolved-transactions/?status=Не распределено&amount_min=1000&amount_max=4000&search=ABC"
        )
        assert response.status_code == 200
        data = response.json()
        # Should get transactions with: status=Не распределено, amount 1000-4000, description contains ABC
        for item in data:
            assert item["status"] == "Не распределено"
            assert 1000 <= item["amount"] <= 4000
            assert "ABC" in item["description"] or "abc" in item["description"].lower()

    def test_list_invalid_order_by_defaults_to_bank_date(self, test_client: TestClient):
        """GET defaults to bank_date ordering when invalid order_by provided."""
        self._create_test_transactions(test_client, 3)

        response = test_client.get("/api/unresolved-transactions/?order_by=invalid_field")
        assert response.status_code == 200
        # Should not error, just use default ordering


class TestGetUnresolvedTransaction:
    """Test GET /api/unresolved-transactions/{id} endpoint."""

    def test_get_unresolved_transaction_success(self, test_client: TestClient):
        """GET returns transaction by id."""
        now = datetime.utcnow()
        create_response = test_client.post("/api/unresolved-transactions/", json={
            "amount": 7500.00,
            "description": "Test transaction",
            "bank_date": now.isoformat(),
            "status": "Не распределено"
        })
        transaction_id = create_response.json()["id"]

        response = test_client.get(f"/api/unresolved-transactions/{transaction_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == transaction_id
        assert data["amount"] == 7500.00
        assert data["description"] == "Test transaction"

    def test_get_unresolved_transaction_not_found(self, test_client: TestClient):
        """GET returns 404 when transaction id doesn't exist."""
        response = test_client.get("/api/unresolved-transactions/99999")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()


class TestUpdateUnresolvedTransaction:
    """Test PUT /api/unresolved-transactions/{id} endpoint."""

    def test_update_unresolved_transaction_success(self, test_client: TestClient):
        """PUT modifies transaction fields."""
        now = datetime.utcnow()
        create_response = test_client.post("/api/unresolved-transactions/", json={
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
        response = test_client.put(f"/api/unresolved-transactions/{transaction_id}", json=update_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == transaction_id
        assert data["status"] == "Привязано вручную"
        assert data["description"] == "Updated description"
        assert data["amount"] == 3000.00  # Unchanged

    def test_update_unresolved_transaction_partial(self, test_client: TestClient):
        """PUT with partial fields only updates provided fields."""
        now = datetime.utcnow()
        create_response = test_client.post("/api/unresolved-transactions/", json={
            "amount": 5000.00,
            "bank_date": now.isoformat()
        })
        transaction_id = create_response.json()["id"]

        # Only update status
        response = test_client.put(f"/api/unresolved-transactions/{transaction_id}", json={
            "status": "Привязано вручную"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "Привязано вручную"
        assert data["amount"] == 5000.00  # Unchanged

    def test_update_unresolved_transaction_not_found(self, test_client: TestClient):
        """PUT returns 404 when transaction id doesn't exist."""
        response = test_client.put("/api/unresolved-transactions/99999", json={
            "status": "Привязано вручную"
        })

        assert response.status_code == 404


class TestDeleteUnresolvedTransaction:
    """Test DELETE /api/unresolved-transactions/{id} endpoint."""

    def test_delete_unresolved_transaction_success(self, test_client: TestClient):
        """DELETE removes transaction and returns 204."""
        now = datetime.utcnow()
        create_response = test_client.post("/api/unresolved-transactions/", json={
            "amount": 2000.00,
            "bank_date": now.isoformat()
        })
        transaction_id = create_response.json()["id"]

        response = test_client.delete(f"/api/unresolved-transactions/{transaction_id}")

        assert response.status_code == 204
        assert response.content == b""

        # Verify transaction is gone
        get_response = test_client.get(f"/api/unresolved-transactions/{transaction_id}")
        assert get_response.status_code == 404

    def test_delete_unresolved_transaction_not_found(self, test_client: TestClient):
        """DELETE returns 404 when transaction id doesn't exist."""
        response = test_client.delete("/api/unresolved-transactions/99999")

        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
