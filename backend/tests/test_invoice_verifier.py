"""
Tests for invoice_verifier service module.

Tests verify that:
- Factory function creates InvoiceVerifier instances
- Exact SKU matching correctly links InvoiceItems to ProjectItems
- RapidFuzz fuzzy name matching handles Cyrillic variants and typos
- Name mismatch detection flags low-similarity items as unmapped
- Quantity discrepancy detection identifies invoice/BOM qty differences
- Extra invoice items (no BOM match) are flagged correctly
- Missing BOM items (no invoice match) are flagged correctly
- Verification verdict logic categorizes all match scenarios
- Invoice.verification_result JSONB stores structured audit trail
- Invoice.status updates based on verification verdict
"""

from unittest.mock import MagicMock, Mock, patch, PropertyMock
from datetime import datetime

import pytest

from backend.services.invoice_verifier import (
    InvoiceVerifier,
    verify_invoice,
    FUZZY_MATCH_THRESHOLD,
    CLARIFICATION_THRESHOLD,
)
from backend.models import Invoice, InvoiceItem, ProjectItem, PurchaseOrder, Project
from backend.schemas.verification import (
    VerificationResult,
    ItemVerification,
    QuantityDiscrepancy,
)


# =============================================================================
# Mock Helpers
# =============================================================================

def create_mock_invoice_item(item_id, sku, name, qty):
    """Create a properly configured InvoiceItem mock with integer qty."""
    item = MagicMock(spec=InvoiceItem)
    item.id = item_id
    item.sku = sku
    item.name = name
    item.qty = qty
    item.project_item_id = None
    return item


def create_mock_project_item(item_id, sku, name, qty):
    """Create a properly configured ProjectItem mock with integer qty."""
    item = MagicMock(spec=ProjectItem)
    item.id = item_id
    item.sku = sku
    item.name = name
    item.qty = qty
    return item


def create_mock_purchase_order(po_id, project_id):
    """Create a properly configured PurchaseOrder mock."""
    po = MagicMock(spec=PurchaseOrder)
    po.id = po_id
    po.project_id = project_id
    return po


def create_mock_invoice(invoice_id, po_id, items):
    """Create a properly configured Invoice mock."""
    invoice = MagicMock(spec=Invoice)
    invoice.id = invoice_id
    invoice.purchase_order_id = po_id
    invoice.items = items
    invoice.verification_result = None
    invoice.status = "Ожидает сверки"
    return invoice


# =============================================================================
# Factory Function Tests
# =============================================================================

class TestVerifyInvoiceFunction:
    """Test verify_invoice factory function."""

    def test_creates_verifier_and_calls_verify(self):
        """Test that factory function creates InvoiceVerifier and delegates."""
        mock_db = Mock()
        mock_invoice_id = 123

        mock_verifier = Mock(spec=InvoiceVerifier)
        mock_result = Mock(spec=VerificationResult)
        mock_result.verdict = "verified"
        mock_verifier.verify_invoice.return_value = mock_result

        with patch("backend.services.invoice_verifier.InvoiceVerifier", return_value=mock_verifier) as mock_init:
            result = verify_invoice(mock_invoice_id, mock_db)

            mock_init.assert_called_once_with(mock_db)
            mock_verifier.verify_invoice.assert_called_once_with(mock_invoice_id)
            assert result == mock_result


# =============================================================================
# InvoiceVerifier Initialization Tests
# =============================================================================

class TestInvoiceVerifierInit:
    """Test InvoiceVerifier initialization."""

    def test_initializes_with_database_session(self):
        """Test that verifier initializes with database session."""
        mock_db = Mock()
        verifier = InvoiceVerifier(mock_db)
        assert verifier.db == mock_db

    def test_default_initialization(self):
        """Test initialization with explicit database session."""
        mock_db = MagicMock()
        verifier = InvoiceVerifier(mock_db)
        assert verifier.db is mock_db


# =============================================================================
# Exact SKU Matching Tests
# =============================================================================

class TestExactSKUMatching:
    """Test exact SKU matching functionality."""

    def test_exact_sku_match_links_items(self):
        """Test that exact SKU match correctly links invoice item to project item."""
        # Setup database mocks
        mock_db = MagicMock()

        # Create mock entities
        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт М10 ст3", 100)
        mock_po = create_mock_purchase_order(100, 200)

        # Configure query mocks - use property mock for joinedload
        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        # Project items query
        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        # InvoiceItem query for quantity check
        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        # Set up different query chains
        mock_db.query.side_effect = [
            mock_query,      # Invoice query
            mock_query,      # PurchaseOrder query
            mock_query_items,  # ProjectItem query
            mock_query_item,  # InvoiceItem query for qty
        ]

        # Create verifier and run verification
        verifier = InvoiceVerifier(mock_db)

        with patch.object(verifier, '_detect_quantity_discrepancies', return_value=[]):
            result = verifier.verify_invoice(1)

        # Verify exact match
        assert isinstance(result, VerificationResult)
        assert len(result.matched_items) == 1
        assert result.matched_items[0].match_type == "exact"
        assert result.matched_items[0].invoice_item_id == 10
        assert result.matched_items[0].project_item_id == 20
        assert result.matched_items[0].sku_match is True
        assert result.matched_items[0].quantity_match is True
        assert result.matched_items[0].name_similarity == 100.0


# =============================================================================
# Fuzzy Name Matching Tests
# =============================================================================

class TestFuzzyNameMatching:
    """Test RapidFuzz fuzzy name matching functionality."""

    def test_fuzzy_name_match_above_threshold(self):
        """Test fuzzy name match with similarity >85% gets linked."""
        mock_db = MagicMock()

        # Create mock entities
        mock_invoice_item = create_mock_invoice_item(10, "BOLT-999", "Болт М10 ст3", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт M10 Ст.3", 100)
        mock_po = create_mock_purchase_order(100, 200)

        # Configure query mocks
        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        # Mock RapidFuzz to return high similarity
        mock_fuzz = MagicMock()
        mock_fuzz.WRatio = Mock(return_value=87)

        mock_process = MagicMock()
        mock_process.extractOne = Mock(return_value=("Болт M10 Ст.3", 87, None))

        verifier = InvoiceVerifier(mock_db)

        with patch('rapidfuzz.fuzz', mock_fuzz):
            with patch('rapidfuzz.process', mock_process):
                with patch.object(verifier, '_detect_quantity_discrepancies', return_value=[]):
                    result = verifier.verify_invoice(1)

        # Verify fuzzy match
        assert len(result.fuzzy_matched_items) == 1
        assert result.fuzzy_matched_items[0].match_type == "fuzzy"
        assert result.fuzzy_matched_items[0].name_similarity == 87
        assert result.fuzzy_matched_items[0].sku_match is False


# =============================================================================
# Name Mismatch Tests
# =============================================================================

class TestNameMismatch:
    """Test name mismatch detection."""

    def test_low_similarity_flagged_as_unmapped(self):
        """Test that low similarity names are flagged as unmapped."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, None, "Гайка М10", 50)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, None, "Болт М10", 100)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        # Mock RapidFuzz to return low similarity
        mock_fuzz = MagicMock()
        mock_fuzz.WRatio = Mock(return_value=45)

        mock_process = MagicMock()
        mock_process.extractOne = Mock(return_value=("Болт М10", 45, None))

        verifier = InvoiceVerifier(mock_db)

        with patch('rapidfuzz.fuzz', mock_fuzz):
            with patch('rapidfuzz.process', mock_process):
                with patch.object(verifier, '_detect_quantity_discrepancies', return_value=[]):
                    result = verifier.verify_invoice(1)

        # Verify unmapped
        assert len(result.unmapped_items) == 1
        assert result.unmapped_items[0] == 10


# =============================================================================
# Quantity Discrepancy Tests
# =============================================================================

class TestQuantityDiscrepancy:
    """Test quantity discrepancy detection."""

    def test_quantity_discrepancy_detected(self):
        """Test that quantity differences are detected."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт М10", 150)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        verifier = InvoiceVerifier(mock_db)
        result = verifier.verify_invoice(1)

        # Verify quantity discrepancy
        assert len(result.quantity_discrepancies) == 1
        assert result.quantity_discrepancies[0].invoice_item_id == 10
        assert result.quantity_discrepancies[0].project_item_id == 20
        assert result.quantity_discrepancies[0].invoice_qty == 100
        assert result.quantity_discrepancies[0].expected_qty == 150
        assert result.quantity_discrepancies[0].discrepancy == -50


# =============================================================================
# Extra Items Tests
# =============================================================================

class TestExtraItems:
    """Test extra invoice items detection."""

    def test_extra_items_flagged(self):
        """Test that invoice items with no BOM match are flagged as extra."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, None, "Шайба М10", 200)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, None, "Болт М10", 100)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        # Mock RapidFuzz to return low similarity
        mock_fuzz = MagicMock()
        mock_fuzz.WRatio = Mock(return_value=30)

        mock_process = MagicMock()
        mock_process.extractOne = Mock(return_value=("Болт М10", 30, None))

        verifier = InvoiceVerifier(mock_db)

        with patch('rapidfuzz.fuzz', mock_fuzz):
            with patch('rapidfuzz.process', mock_process):
                with patch.object(verifier, '_detect_quantity_discrepancies', return_value=[]):
                    result = verifier.verify_invoice(1)

        # Verify extra item flagged
        assert len(result.extra_items) == 1
        assert result.extra_items[0] == 10


# =============================================================================
# Missing Items Tests
# =============================================================================

class TestMissingItems:
    """Test missing BOM items detection."""

    def test_missing_items_flagged(self):
        """Test that BOM items with no invoice match are flagged as missing."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item1 = create_mock_project_item(20, "BOLT-001", "Болт М10", 100)
        mock_project_item2 = create_mock_project_item(21, "NUT-001", "Гайка М10", 200)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [
            mock_project_item1,
            mock_project_item2
        ]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        verifier = InvoiceVerifier(mock_db)
        result = verifier.verify_invoice(1)

        # Verify missing item flagged
        assert len(result.missing_items) == 1
        assert result.missing_items[0] == 21


# =============================================================================
# Verdict Logic Tests
# =============================================================================

class TestVerdictLogic:
    """Test overall verification verdict determination."""

    def test_verified_verdict_all_exact_matches(self):
        """Test that all exact matches produce 'verified' verdict."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт М10", 100)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        verifier = InvoiceVerifier(mock_db)
        result = verifier.verify_invoice(1)

        assert result.verdict == "verified"
        assert mock_invoice.status == "Сверен"

    def test_partial_verdict_with_discrepancies(self):
        """Test that quantity discrepancies produce 'partial' verdict."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт М10", 150)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        verifier = InvoiceVerifier(mock_db)
        result = verifier.verify_invoice(1)

        assert result.verdict == "partial"
        assert mock_invoice.status == "Ошибки"

    def test_failed_verdict_no_matches(self):
        """Test that no matches produce 'failed' verdict."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, None, "Random Item", 10)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, None, "Different Item", 100)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        # Mock RapidFuzz to return low similarity
        mock_fuzz = MagicMock()
        mock_fuzz.WRatio = Mock(return_value=30)

        mock_process = MagicMock()
        mock_process.extractOne = Mock(return_value=("Different Item", 30, None))

        verifier = InvoiceVerifier(mock_db)

        with patch('rapidfuzz.fuzz', mock_fuzz):
            with patch('rapidfuzz.process', mock_process):
                with patch.object(verifier, '_detect_quantity_discrepancies', return_value=[]):
                    result = verifier.verify_invoice(1)

        assert result.verdict == "failed"
        assert mock_invoice.status == "Ошибки"


# =============================================================================
# Verification Result Storage Tests
# =============================================================================

class TestVerificationResultStorage:
    """Test verification result storage in Invoice.verification_result."""

    def test_verification_result_stored_as_jsonb(self):
        """Test that verification result is stored in Invoice.verification_result."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт М10", 100)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        verifier = InvoiceVerifier(mock_db)
        result = verifier.verify_invoice(1)

        # Verify verification result stored
        assert mock_invoice.verification_result is not None
        stored = mock_invoice.verification_result
        assert stored['verdict'] == 'verified'
        assert 'matched_items' in stored
        assert 'verified_at' in stored

    def test_invoice_status_updated_based_on_verdict(self):
        """Test that Invoice.status is updated based on verdict."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт М10", 100)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        verifier = InvoiceVerifier(mock_db)
        verifier.verify_invoice(1)

        # Verify status updated
        assert mock_invoice.status == "Сверен"

    def test_database_commit_called(self):
        """Test that database commit is called to persist changes."""
        mock_db = MagicMock()

        mock_invoice_item = create_mock_invoice_item(10, "BOLT-001", "Болт М10", 100)
        mock_invoice = create_mock_invoice(1, 100, [mock_invoice_item])

        mock_project_item = create_mock_project_item(20, "BOLT-001", "Болт М10", 100)
        mock_po = create_mock_purchase_order(100, 200)

        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.side_effect = [mock_invoice, mock_po]

        mock_query_items = MagicMock()
        mock_query_items.filter.return_value.all.return_value = [mock_project_item]

        mock_query_item = MagicMock()
        mock_query_item.filter.return_value.first.return_value = mock_invoice_item

        mock_db.query.side_effect = [
            mock_query,
            mock_query,
            mock_query_items,
            mock_query_item,
        ]

        verifier = InvoiceVerifier(mock_db)
        verifier.verify_invoice(1)

        # Verify commit called
        mock_db.commit.assert_called()


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test error handling in invoice verification."""

    def test_invoice_not_found_raises_value_error(self):
        """Test that ValueError is raised when invoice not found."""
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_db.query.return_value = mock_query

        verifier = InvoiceVerifier(mock_db)

        with pytest.raises(ValueError) as exc_info:
            verifier.verify_invoice(999)

        assert "not found" in str(exc_info.value).lower()

    def test_value_error_not_caught(self):
        """Test that ValueError from missing invoice is not caught."""
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        mock_db.query.return_value = mock_query

        verifier = InvoiceVerifier(mock_db)

        with pytest.raises(ValueError):
            verifier.verify_invoice(1)


# =============================================================================
# Constants Tests
# =============================================================================

class TestConstants:
    """Test module constants."""

    def test_fuzzy_match_threshold(self):
        """Test FUZZY_MATCH_THRESHOLD constant."""
        assert FUZZY_MATCH_THRESHOLD == 85

    def test_clarification_threshold(self):
        """Test CLARIFICATION_THRESHOLD constant."""
        assert CLARIFICATION_THRESHOLD == 60


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
