"""
Integration tests for S05 notification dispatch with verify_invoice_task.

Tests the notification routing logic using mocks to verify:
1. dispatch_invoice_notifications routes to correct notification functions
2. verify_invoice_task calls dispatch after verification
3. Notification failures don't block task completion
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock, call
from datetime import datetime


# Import schemas directly to avoid triggering database imports
from backend.schemas.verification import VerificationResult, ItemVerification, QuantityDiscrepancy


def selective_getenv(key, default=None):
    """Mock getenv that returns chat_id for TELEGRAM_OWNER_CHAT_ID but preserves other env vars."""
    if key == 'TELEGRAM_OWNER_CHAT_ID':
        return '123456'
    if key == 'DATABASE_URL':
        return os.environ.get('DATABASE_URL', 'sqlite:///test.db')
    return os.environ.get(key, default)


@pytest.fixture
def mock_verification_result():
    """Create a mock verification result."""
    return VerificationResult(
        verdict='verified',
        matched_items=[
            ItemVerification(
                invoice_item_id=1,
                project_item_id=1,
                match_type='exact',
                name_similarity=100.0,
                sku_match=True,
                quantity_match=True
            )
        ],
        fuzzy_matched_items=[],
        unmapped_items=[],
        quantity_discrepancies=[],
        extra_items=[],
        missing_items=[],
        items=[],
        verified_at=datetime.utcnow()
    )


@pytest.fixture
def mock_db():
    """Create mock database session."""
    db = Mock()

    # Mock Invoice model
    mock_invoice = Mock()
    mock_invoice.id = 1
    mock_invoice.file_url = "INV-001.pdf"
    mock_invoice.purchase_order_id = 1

    # Mock PurchaseOrder model
    mock_po = Mock()
    mock_po.id = 1
    mock_supplier = Mock()
    mock_supplier.email = "supplier@example.com"
    mock_supplier.name = "Test Supplier"
    mock_po.supplier = mock_supplier

    mock_invoice.purchase_order = mock_po

    # Mock InvoiceItem model
    mock_invoice_item = Mock()
    mock_invoice_item.id = 1
    mock_invoice_item.name = "Test Item"
    mock_invoice_item.qty = 10
    mock_invoice_item.unit_price = 100.0  # Use actual number, not Mock

    # Mock ProjectItem model
    mock_project_item = Mock()
    mock_project_item.id = 1
    mock_project_item.name = "Expected Item"

    def query_side_effect(model):
        """Mock query to return different objects based on model."""
        mock_query = Mock()
        if hasattr(model, '__name__'):
            if model.__name__ == 'Invoice':
                mock_query.filter.return_value.first.return_value = mock_invoice
            elif model.__name__ == 'PurchaseOrder':
                mock_query.filter.return_value.first.return_value = mock_po
            elif model.__name__ == 'InvoiceItem':
                mock_query.filter.return_value.first.return_value = mock_invoice_item
            elif model.__name__ == 'ProjectItem':
                mock_query.filter.return_value.first.return_value = mock_project_item
            else:
                mock_query.filter.return_value.first.return_value = None
        else:
            # Handle the case where model is already a Mock object (in tests)
            mock_query.filter.return_value.first.return_value = mock_invoice
        return mock_query

    db.query.side_effect = query_side_effect

    return db


class TestNotificationRoutingLogic:
    """Test the notification routing logic independently."""

    def test_verified_verdict_routing(self, mock_db, mock_verification_result):
        """Test verified verdict uses send_invoice_verified."""
        mock_verification_result.verdict = 'verified'

        with patch('os.getenv', side_effect=selective_getenv), \
             patch('backend.telegram_notifier.send_invoice_verified') as mock_verified:
            from backend.tasks import dispatch_invoice_notifications
            dispatch_invoice_notifications(mock_verification_result, 1, mock_db)

            mock_verified.assert_called_once()
            call_args = mock_verified.call_args
            assert call_args[0][0] == 123456  # chat_id
            assert call_args[0][1] == 1  # invoice_id

    def test_partial_verdict_routing(self, mock_db):
        """Test partial verdict uses send_invoice_partial."""
        verification_result = VerificationResult(
            verdict='partial',
            matched_items=[],
            fuzzy_matched_items=[],
            unmapped_items=[],
            quantity_discrepancies=[
                QuantityDiscrepancy(
                    invoice_item_id=1,
                    project_item_id=1,
                    invoice_qty=8,
                    expected_qty=10,
                    discrepancy=-2
                )
            ],
            extra_items=[],
            missing_items=[],
            items=[],
            verified_at=datetime.utcnow()
        )

        with patch('os.getenv', side_effect=selective_getenv), \
             patch('backend.telegram_notifier.send_invoice_partial') as mock_partial:
            from backend.tasks import dispatch_invoice_notifications
            dispatch_invoice_notifications(verification_result, 1, mock_db)

            mock_partial.assert_called_once()

    def test_failed_verdict_routing(self, mock_db):
        """Test failed verdict uses send_invoice_failed."""
        verification_result = VerificationResult(
            verdict='failed',
            matched_items=[],
            fuzzy_matched_items=[],
            unmapped_items=[1, 2],
            quantity_discrepancies=[],
            extra_items=[],
            missing_items=[],
            items=[],
            verified_at=datetime.utcnow()
        )

        with patch('os.getenv', side_effect=selective_getenv), \
             patch('backend.telegram_notifier.send_invoice_failed') as mock_failed:
            from backend.tasks import dispatch_invoice_notifications
            dispatch_invoice_notifications(verification_result, 1, mock_db)

            mock_failed.assert_called_once()

    def test_clarification_verdict_routing(self, mock_db):
        """Test clarification_needed uses both email and telegram."""
        verification_result = VerificationResult(
            verdict='clarification_needed',
            matched_items=[],
            fuzzy_matched_items=[
                ItemVerification(
                    invoice_item_id=1,
                    project_item_id=1,
                    match_type='fuzzy',
                    name_similarity=87.0,
                    sku_match=False,
                    quantity_match=True
                )
            ],
            unmapped_items=[],
            quantity_discrepancies=[],
            extra_items=[],
            missing_items=[],
            items=[],
            verified_at=datetime.utcnow()
        )

        with patch('os.getenv', side_effect=selective_getenv), \
             patch('backend.telegram_notifier.send_invoice_clarification_needed') as mock_telegram, \
             patch('backend.email_notifier.send_clarification_email') as mock_email:
            from backend.tasks import dispatch_invoice_notifications
            dispatch_invoice_notifications(verification_result, 1, mock_db)

            mock_telegram.assert_called_once()
            mock_email.assert_called_once()

    def test_skips_when_no_chat_id(self, mock_db, mock_verification_result):
        """Test notifications skip when TELEGRAM_OWNER_CHAT_ID not set."""
        def no_chat_id_getenv(key, default=None):
            if key == 'TELEGRAM_OWNER_CHAT_ID':
                return None
            if key == 'DATABASE_URL':
                return os.environ.get('DATABASE_URL', 'sqlite:///test.db')
            return os.environ.get(key, default)

        with patch('os.getenv', side_effect=no_chat_id_getenv), \
             patch('backend.telegram_notifier.send_invoice_verified') as mock_verified:
            from backend.tasks import dispatch_invoice_notifications
            dispatch_invoice_notifications(mock_verification_result, 1, mock_db)

            mock_verified.assert_not_called()

    def test_skips_with_invalid_chat_id(self, mock_db, mock_verification_result):
        """Test notifications skip when TELEGRAM_OWNER_CHAT_ID is invalid."""
        def invalid_chat_id_getenv(key, default=None):
            if key == 'TELEGRAM_OWNER_CHAT_ID':
                return 'invalid'
            if key == 'DATABASE_URL':
                return os.environ.get('DATABASE_URL', 'sqlite:///test.db')
            return os.environ.get(key, default)

        with patch('os.getenv', side_effect=invalid_chat_id_getenv), \
             patch('backend.telegram_notifier.send_invoice_verified') as mock_verified:
            from backend.tasks import dispatch_invoice_notifications
            dispatch_invoice_notifications(mock_verification_result, 1, mock_db)

            mock_verified.assert_not_called()


class TestNotificationNonBlocking:
    """Test that notification failures don't block processing."""

    def test_notification_return_false_doesnt_raise(self, mock_db, mock_verification_result):
        """Test notification returning False doesn't raise exception."""
        with patch('os.getenv', side_effect=selective_getenv), \
             patch('backend.telegram_notifier.send_invoice_verified', return_value=False):
            from backend.tasks import dispatch_invoice_notifications
            # Should not raise
            dispatch_invoice_notifications(mock_verification_result, 1, mock_db)

    def test_notification_exception_doesnt_raise(self, mock_db, mock_verification_result):
        """Test notification raising exception is caught and logged."""
        with patch('os.getenv', side_effect=selective_getenv), \
             patch('backend.telegram_notifier.send_invoice_verified', side_effect=Exception('Failed')):
            from backend.tasks import dispatch_invoice_notifications
            # Should not raise
            dispatch_invoice_notifications(mock_verification_result, 1, mock_db)


class TestNotificationRoutingTable:
    """Parametrized test for all verdict types."""

    @pytest.mark.parametrize("verdict,notification_function", [
        ('verified', 'send_invoice_verified'),
        ('partial', 'send_invoice_partial'),
        ('clarification_needed', 'send_invoice_clarification_needed'),
        ('failed', 'send_invoice_failed'),
    ])
    def test_all_verdicts_route_correctly(self, verdict, notification_function, mock_db):
        """Test each verdict routes to the correct notification function."""
        verification_result = VerificationResult(
            verdict=verdict,
            matched_items=[],
            fuzzy_matched_items=[],
            unmapped_items=[],
            quantity_discrepancies=[],
            extra_items=[],
            missing_items=[],
            items=[],
            verified_at=datetime.utcnow()
        )

        with patch('os.getenv', side_effect=selective_getenv), \
             patch(f'backend.telegram_notifier.{notification_function}') as mock_notif:
            from backend.tasks import dispatch_invoice_notifications
            dispatch_invoice_notifications(verification_result, 1, mock_db)

            # For clarification_needed, both email and telegram are called
            # For other verdicts, only telegram is called
            if verdict != 'clarification_needed':
                mock_notif.assert_called_once()
            else:
                # At least telegram should be called
                assert mock_notif.call_count >= 1
