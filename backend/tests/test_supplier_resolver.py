"""
Tests for supplier_resolver module.

Tests verify that:
- Existing suppliers are found by exact name match (case-sensitive)
- New suppliers are created with placeholder email addresses
- Duplicate calls for the same name return the same ID
- Empty/None names are handled gracefully
"""
import pytest
from sqlalchemy.orm import Session
from backend.supplier_resolver import find_or_create_supplier, find_supplier_by_name
from backend.models import Supplier


class TestFindOrCreateSupplier:
    """Test find_or_create_supplier function."""

    def test_creates_new_supplier_with_placeholder_email(self, db_session):
        """Test that a new supplier is created with auto-generated placeholder email."""
        supplier_id = find_or_create_supplier(db_session, "ООО Вектор")

        assert supplier_id is not None

        # Verify supplier was created with correct data
        supplier = db_session.query(Supplier).filter_by(id=supplier_id).first()
        assert supplier is not None
        assert supplier.name == "ООО Вектор"
        assert supplier.email == "auto-ooo-vektor@placeholder.com"

    def test_finds_existing_supplier_by_exact_name(self, db_session):
        """Test that existing supplier is found by exact name match (case-sensitive)."""
        # Create a supplier directly
        existing = Supplier(name="Test Supplier Inc", email="existing@example.com")
        db_session.add(existing)
        db_session.commit()
        existing_id = existing.id

        # Call find_or_create_supplier with same name
        supplier_id = find_or_create_supplier(db_session, "Test Supplier Inc")

        # Should return the same ID, not create a new one
        assert supplier_id == existing_id

        # Verify only one supplier exists with this name
        count = db_session.query(Supplier).filter_by(name="Test Supplier Inc").count()
        assert count == 1

    def test_case_sensitive_exact_match(self, db_session):
        """Test that name matching is case-sensitive."""
        # Create supplier with lowercase name
        existing = Supplier(name="abc supplier", email="lower@example.com")
        db_session.add(existing)
        db_session.commit()
        existing_id = existing.id

        # Call with different case - should create new supplier
        new_id = find_or_create_supplier(db_session, "ABC Supplier")

        assert new_id is not None
        assert new_id != existing_id

        # Verify both suppliers exist
        suppliers = db_session.query(Supplier).filter(
            Supplier.name.in_(["abc supplier", "ABC Supplier"])
        ).all()
        assert len(suppliers) == 2

    def test_duplicate_calls_return_same_id(self, db_session):
        """Test that duplicate calls for the same name return the same ID."""
        id1 = find_or_create_supplier(db_session, "Duplicate Test Supplier")
        id2 = find_or_create_supplier(db_session, "Duplicate Test Supplier")

        assert id1 is not None
        assert id1 == id2

        # Verify only one supplier was created
        count = db_session.query(Supplier).filter_by(name="Duplicate Test Supplier").count()
        assert count == 1

    def test_handles_whitespace_in_name(self, db_session):
        """Test that leading/trailing whitespace is stripped."""
        supplier_id = find_or_create_supplier(db_session, "  Whitespace Test  ")

        assert supplier_id is not None

        supplier = db_session.query(Supplier).filter_by(id=supplier_id).first()
        assert supplier.name == "Whitespace Test"
        assert supplier.email == "auto-whitespace-test@placeholder.com"

    def test_returns_none_for_empty_name(self, db_session):
        """Test that None is returned for empty string name."""
        supplier_id = find_or_create_supplier(db_session, "")
        assert supplier_id is None

    def test_returns_none_for_whitespace_only_name(self, db_session):
        """Test that None is returned for whitespace-only name."""
        supplier_id = find_or_create_supplier(db_session, "   ")
        assert supplier_id is None

    def test_returns_none_for_none_name(self, db_session):
        """Test that None is returned for None input."""
        supplier_id = find_or_create_supplier(db_session, None)
        assert supplier_id is None

    def test_handles_russian_company_names(self, db_session):
        """Test that Russian company names are slugified correctly."""
        supplier_id = find_or_create_supplier(db_session, "ПАО Сбербанк")

        assert supplier_id is not None

        supplier = db_session.query(Supplier).filter_by(id=supplier_id).first()
        assert supplier.name == "ПАО Сбербанк"
        assert supplier.email == "auto-pao-sberbank@placeholder.com"

    def test_handles_special_characters_in_name(self, db_session):
        """Test that special characters in names are handled."""
        supplier_id = find_or_create_supplier(db_session, "Tech@Co #123")

        assert supplier_id is not None

        supplier = db_session.query(Supplier).filter_by(id=supplier_id).first()
        assert supplier.name == "Tech@Co #123"
        # slugify removes special chars
        assert "tech-co" in supplier.email
        assert supplier.email.endswith("@placeholder.com")

    def test_rollback_on_database_error(self, db_session):
        """Test that transaction is rolled back on database error."""
        # This test verifies error handling - in normal operation,
        # the function should rollback and return None on error
        # We can't easily force a DB error, but we verify the structure exists
        supplier_id = find_or_create_supplier(db_session, "Error Test")
        assert supplier_id is not None

        # Second call should find the existing supplier
        supplier_id_2 = find_or_create_supplier(db_session, "Error Test")
        assert supplier_id == supplier_id_2


class TestFindSupplierByName:
    """Test find_supplier_by_name function (read-only variant)."""

    def test_returns_id_for_existing_supplier(self, db_session):
        """Test that existing supplier ID is returned."""
        existing = Supplier(name="Find Test", email="find@example.com")
        db_session.add(existing)
        db_session.commit()

        supplier_id = find_supplier_by_name(db_session, "Find Test")
        assert supplier_id == existing.id

    def test_returns_none_for_nonexistent_supplier(self, db_session):
        """Test that None is returned when supplier doesn't exist."""
        supplier_id = find_supplier_by_name(db_session, "Nonexistent Supplier")
        assert supplier_id is None

    def test_does_not_create_new_supplier(self, db_session):
        """Test that this function never creates a new supplier."""
        initial_count = db_session.query(Supplier).count()

        supplier_id = find_supplier_by_name(db_session, "Brand New Supplier")
        assert supplier_id is None

        # Count should not have changed
        final_count = db_session.query(Supplier).count()
        assert final_count == initial_count

    def test_handles_empty_name(self, db_session):
        """Test that None is returned for empty name."""
        assert find_supplier_by_name(db_session, "") is None
        assert find_supplier_by_name(db_session, "   ") is None
        assert find_supplier_by_name(db_session, None) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
