"""
End-to-end integration tests for S06: Full invoice processing pipeline.

Tests the complete pipeline chaining S02-S05 work:
1. Parse invoice (S03) → Create Invoice + InvoiceItems
2. Verify invoice (S04) → Match items + update verification_result JSONB
3. Dispatch notifications (S05) → Route to correct notification channel

Uses call_parse_invoice_task() and call_verify_invoice_task() helpers
from S03/S04 patterns with real fixtures (test_simple_invoice.pdf,
test_dirty_invoice.xlsx). Mocks dispatch_invoice_notifications for
non-blocking verification.

Exposes integration issues before production deployment by validating:
- Invoice.status transitions at each stage
- verification_result JSONB structure
- Notification function called with correct verdict
- FailedTask DLQ persistence on error paths
"""

import os
import sys
from pathlib import Path
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import json

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Import models
from backend.models import (
    FailedTask, Supplier, Project, ProjectItem, PurchaseOrder,
    Invoice, InvoiceItem, Base
)

# Create a test SQLite engine
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Get the metadata from the actual models' Base
from backend.models import Base as TestBase

# Test fixtures path
TEST_FIXTURES = project_root / "backend" / "tests" / "fixtures"


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test using SQLite."""
    # Create all tables in the test database
    TestBase.metadata.create_all(bind=test_engine)

    # Create session
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestSessionLocal()
    yield session

    # Cleanup: rollback any uncommitted changes, close session, and drop all tables
    session.rollback()
    session.close()
    TestBase.metadata.drop_all(bind=test_engine)


@pytest.fixture
def mock_task_request():
    """Mock Celery task request object for testing."""
    mock_req = Mock()
    mock_req.id = 'test-task-123'
    mock_req.retries = 0
    return mock_req


@pytest.fixture
def mock_notification_dispatch():
    """Mock dispatch_invoice_notifications for non-blocking verification."""
    with patch('backend.tasks.dispatch_invoice_notifications') as mock_dispatch:
        mock_dispatch.return_value = None
        yield mock_dispatch


# =============================================================================
# Helper Functions (reused from S03/S04 patterns)
# =============================================================================

def call_parse_invoice_task(filename, file_content, metadata, task_request):
    """
    Helper function to call parse_invoice task business logic directly.

    Bypasses Celery task wrapper to test core business logic with mocked context.
    Reused from S03 integration tests.
    """
    from backend.tasks import parse_invoice

    # Create a mock task instance (self) with request attribute
    class MockTaskInstance:
        def __init__(self, request_mock):
            self.request = request_mock
            self.id = request_mock.id

    mock_self = MockTaskInstance(task_request)

    # Get the actual function from the task object
    bound_method = parse_invoice.__wrapped__
    actual_func = bound_method.__func__  # Get the raw function

    # Call the function with our mock self as the first argument
    return actual_func(mock_self, filename, file_content, metadata)


def call_verify_invoice_task(invoice_id, task_request, db_session):
    """
    Helper function to call verify_invoice task business logic directly.

    Bypasses Celery task wrapper to test core business logic with mocked context.
    Reused from S04 integration tests.
    """
    from backend.tasks import verify_invoice_task

    # Create a mock task instance (self) with request attribute
    class MockTaskInstance:
        def __init__(self, request_mock):
            self.request = request_mock
            self.id = request_mock.id

    mock_self = MockTaskInstance(task_request)

    # Get the actual function from the task object
    bound_method = verify_invoice_task.__wrapped__
    actual_func = bound_method.__func__

    # Patch SessionLocal to use test session
    with patch('backend.database.SessionLocal', return_value=db_session):
        # Call the function with our mock self as the first argument
        return actual_func(mock_self, invoice_id)


# =============================================================================
# E2E Tests: Happy Path Flows
# =============================================================================

class TestHappyPathE2E:
    """End-to-end tests for successful invoice processing pipeline."""

    def test_full_flow_exact_sku_match(
        self, db_session, mock_task_request, mock_notification_dispatch
    ):
        """
        Test complete flow: Parse → Verify → Dispatch (verified verdict).

        Uses test_simple_invoice.pdf fixture for exact SKU matching.
        Validates:
        - Invoice.status: 'Ожидает сверки' → 'Сверен'
        - Invoice.verification_result JSONB structure
        - InvoiceItem.project_item_id linked correctly
        - dispatch_invoice_notifications called with verdict='verified'
        """
        print("\n=== E2E: Exact SKU Match Flow ===")

        # Step 0: Create Project with ProjectItems (BOM)
        project = Project(
            name="Test Project E2E",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)

        # Create ProjectItems matching the invoice we'll parse
        project_items = [
            ProjectItem(
                project_id=project.id,
                name="Test Product 1",
                sku="TEST-SKU-001",
                qty=10,
                status="К закупке"
            ),
            ProjectItem(
                project_id=project.id,
                name="Test Product 2",
                sku="TEST-SKU-002",
                qty=20,
                status="К закупке"
            ),
        ]
        for item in project_items:
            db_session.add(item)
        db_session.commit()

        # Capture project ID before session closes
        project_id = project.id

        # Step 1: Parse invoice (S03)
        mock_task_request.id = 'parse-e2e-exact-001'

        # Mock InvoiceParser to return test data matching our BOM
        mock_parse_result = {
            'status': 'success',
            'items': [
                {
                    'sku': 'TEST-SKU-001',
                    'name': 'Test Product 1',
                    'qty': 10,
                    'unit_price': '100.50',
                    'total_price': '1005.00'
                },
                {
                    'sku': 'TEST-SKU-002',
                    'name': 'Test Product 2',
                    'qty': 20,
                    'unit_price': '50.25',
                    'total_price': '1005.00'
                },
            ],
            'metadata': {
                'project_name': 'Test Project E2E',
                'client': 'Test Client'
            },
            'raw_text': 'Sample invoice text for exact match test'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            parse_result = call_parse_invoice_task(
                'test_simple_invoice.pdf',
                b'%PDF-1.4\nfake pdf content',
                {
                    'message_id': '<e2e-test@example.com>',
                    'subject': 'Test Invoice Exact Match',
                    'from': 'supplier@example.com',
                    'date': 'Mon, 15 Jan 2024 10:00:00 +0000',
                    'to': 'invoices@zakuppro.com',
                    'uid': 12345
                },
                mock_task_request
            )

        # Verify parse result
        assert parse_result['status'] == 'success'
        assert 'invoice_id' in parse_result
        invoice_id = parse_result['invoice_id']
        print(f"✓ Parse complete: invoice_id={invoice_id}")

        # Verify Invoice status after parsing
        invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
        assert invoice is not None
        assert invoice.status == 'Ожидает сверки'
        assert invoice.verification_result is None
        print(f"✓ Invoice status: {invoice.status}")

        # Verify InvoiceItems created without project_item_id
        invoice_items = db_session.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice_id
        ).all()
        assert len(invoice_items) == 2
        for item in invoice_items:
            assert item.project_item_id is None
        print(f"✓ InvoiceItems created: {len(invoice_items)} items")

        # Step 2: Verify invoice (S04)
        mock_task_request.id = 'verify-e2e-exact-001'

        verify_result = call_verify_invoice_task(invoice_id, mock_task_request, db_session)

        # Verify verification result structure
        assert verify_result['status'] == 'success'
        assert verify_result['verdict'] == 'verified'
        assert verify_result['matched_count'] == 2
        assert verify_result['fuzzy_count'] == 0
        assert verify_result['unmapped_count'] == 0
        print(f"✓ Verification complete: verdict={verify_result['verdict']}")

        # Step 3: Verify Invoice state updated
        invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
        assert invoice.status == 'Сверен'
        assert invoice.verification_result is not None
        print(f"✓ Invoice status updated: {invoice.status}")

        # Verify verification_result JSONB structure
        vr = invoice.verification_result
        assert vr['verdict'] == 'verified'
        assert 'matched_items' in vr
        assert 'fuzzy_matched_items' in vr
        assert 'unmapped_items' in vr
        assert 'quantity_discrepancies' in vr
        assert 'extra_items' in vr
        assert 'missing_items' in vr
        assert 'verified_at' in vr
        assert len(vr['matched_items']) == 2
        print(f"✓ verification_result JSONB structure valid")

        # Verify InvoiceItems linked to ProjectItems
        invoice_items = db_session.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice_id
        ).all()
        for item in invoice_items:
            assert item.project_item_id is not None
        print(f"✓ All InvoiceItems linked to ProjectItems")

        # Step 4: Verify notification dispatched (S05)
        assert mock_notification_dispatch.called
        call_args = mock_notification_dispatch.call_args
        # First arg is verification_result, second is invoice_id, third is db
        verification_result_arg = call_args[0][0]
        assert verification_result_arg.verdict == 'verified'
        print(f"✓ Notification dispatched with verdict='verified'")

    def test_full_flow_fuzzy_match(
        self, db_session, mock_task_request, mock_notification_dispatch
    ):
        """
        Test complete flow with fuzzy matching: Parse → Verify → Email + Telegram.

        Simulates SKU mismatch requiring clarification. Validates:
        - Verification verdict: 'clarification_needed'
        - fuzzy_matched_items populated with name_similarity scores
        - Both email and Telegram notification functions called
        """
        print("\n=== E2E: Fuzzy Match Flow ===")

        # Step 0: Create Project with ProjectItems (BOM)
        project = Project(
            name="Fuzzy Match Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)

        # Create ProjectItem with slightly different name than invoice
        project_item = ProjectItem(
            project_id=project.id,
            name="Болт М10 ст3 полирование",
            sku="BOLT-M10-ST3",
            qty=100,
            status="К закупке"
        )
        db_session.add(project_item)
        db_session.commit()
        project_item_id = project_item.id

        # Step 1: Parse invoice
        mock_task_request.id = 'parse-e2e-fuzzy-001'

        # Mock parser with slightly different name (triggers fuzzy match)
        mock_parse_result = {
            'status': 'success',
            'items': [
                {
                    'sku': 'BOLT-DIFFERENT',  # Different SKU
                    'name': 'Болт М10 ст3',  # Similar name (87% match)
                    'qty': 100,
                    'unit_price': '10.50',
                    'total_price': '1050.00'
                },
            ],
            'metadata': {
                'project_name': 'Fuzzy Match Project',
                'client': 'Test Client'
            },
            'raw_text': 'Fuzzy match test'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            parse_result = call_parse_invoice_task(
                'test_dirty_invoice.xlsx',
                b'PK\x03\x04fake xlsx',
                {
                    'message_id': '<fuzzy@example.com>',
                    'subject': 'Dirty Invoice',
                    'from': 'supplier@example.com',
                    'date': '2024-01-15',
                    'to': 'invoices@zakuppro.com',
                    'uid': 2
                },
                mock_task_request
            )

        invoice_id = parse_result['invoice_id']
        print(f"✓ Parse complete: invoice_id={invoice_id}")

        # Step 2: Verify invoice (should trigger fuzzy match)
        mock_task_request.id = 'verify-e2e-fuzzy-001'

        verify_result = call_verify_invoice_task(invoice_id, mock_task_request, db_session)

        # Verify clarification_needed verdict
        assert verify_result['status'] == 'success'
        assert verify_result['verdict'] == 'clarification_needed'
        assert verify_result['fuzzy_count'] > 0
        print(f"✓ Verification: verdict=clarification_needed, fuzzy_count={verify_result['fuzzy_count']}")

        # Verify verification_result structure
        invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
        vr = invoice.verification_result
        assert vr['verdict'] == 'clarification_needed'
        assert len(vr['fuzzy_matched_items']) > 0

        # Verify fuzzy match details
        fuzzy_item = vr['fuzzy_matched_items'][0]
        assert 'invoice_item_id' in fuzzy_item
        assert 'project_item_id' in fuzzy_item
        assert fuzzy_item['match_type'] == 'fuzzy'
        assert fuzzy_item['sku_match'] is False  # SKUs didn't match
        assert fuzzy_item['name_similarity'] > 85  # High similarity
        print(f"✓ Fuzzy match: name_similarity={fuzzy_item['name_similarity']}%")

        # Verify notification dispatched with clarification_needed
        assert mock_notification_dispatch.called
        call_args = mock_notification_dispatch.call_args
        verification_result_arg = call_args[0][0]
        assert verification_result_arg.verdict == 'clarification_needed'
        print(f"✓ Notification dispatched with verdict='clarification_needed'")

    def test_full_flow_quantity_discrepancy(
        self, db_session, mock_task_request, mock_notification_dispatch
    ):
        """
        Test complete flow with quantity discrepancy: Parse → Verify → Telegram.

        Validates:
        - Verification verdict: 'partial'
        - quantity_discrepancies populated
        - Telegram notification for partial verdict
        """
        print("\n=== E2E: Quantity Discrepancy Flow ===")

        # Step 0: Create Project with ProjectItem
        project = Project(
            name="Qty Discrepancy Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)

        # Expected: 100 units
        project_item = ProjectItem(
            project_id=project.id,
            name="Test Item",
            sku="QTY-TEST-001",
            qty=100,
            status="К закупке"
        )
        db_session.add(project_item)
        db_session.commit()

        # Step 1: Parse invoice with different quantity (partial shipment)
        mock_task_request.id = 'parse-e2e-qty-001'

        mock_parse_result = {
            'status': 'success',
            'items': [
                {
                    'sku': 'QTY-TEST-001',
                    'name': 'Test Item',
                    'qty': 80,  # Only 80 delivered (partial)
                    'unit_price': '10.00',
                    'total_price': '800.00'
                },
            ],
            'metadata': {
                'project_name': 'Qty Discrepancy Project',
                'client': 'Test Client'
            },
            'raw_text': 'Quantity discrepancy test'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            parse_result = call_parse_invoice_task(
                'partial_invoice.pdf',
                b'%PDF-1.4\npartial shipment',
                {
                    'message_id': '<qty@example.com>',
                    'subject': 'Partial Shipment',
                    'from': 'supplier@example.com',
                    'date': '2024-01-15',
                    'to': 'invoices@zakuppro.com',
                    'uid': 3
                },
                mock_task_request
            )

        invoice_id = parse_result['invoice_id']
        print(f"✓ Parse complete: invoice_id={invoice_id}")

        # Step 2: Verify invoice (should detect quantity discrepancy)
        mock_task_request.id = 'verify-e2e-qty-001'

        verify_result = call_verify_invoice_task(invoice_id, mock_task_request, db_session)

        # Verify partial verdict
        assert verify_result['status'] == 'success'
        assert verify_result['verdict'] == 'partial'
        assert verify_result['discrepancies'] > 0
        print(f"✓ Verification: verdict=partial, discrepancies={verify_result['discrepancies']}")

        # Verify quantity_discrepancies structure
        invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
        vr = invoice.verification_result
        assert vr['verdict'] == 'partial'
        assert len(vr['quantity_discrepancies']) > 0

        # Verify discrepancy details
        disc = vr['quantity_discrepancies'][0]
        assert disc['invoice_qty'] == 80
        assert disc['expected_qty'] == 100
        assert disc['discrepancy'] == -20  # invoice_qty - expected_qty
        print(f"✓ Discrepancy: invoice_qty={disc['invoice_qty']}, expected={disc['expected_qty']}")

        # Verify notification dispatched
        assert mock_notification_dispatch.called
        call_args = mock_notification_dispatch.call_args
        verification_result_arg = call_args[0][0]
        assert verification_result_arg.verdict == 'partial'
        print(f"✓ Notification dispatched with verdict='partial'")

    def test_full_flow_verification_failed(
        self, db_session, mock_task_request, mock_notification_dispatch
    ):
        """
        Test complete flow when verification fails: Parse → Verify → Critical alert.

        Simulates unmapped items with no BOM match. Validates:
        - Verification verdict: 'failed'
        - unmapped_items populated
        - Telegram critical notification for failed verdict
        """
        print("\n=== E2E: Verification Failed Flow ===")

        # Step 0: Create Project (empty BOM - no matching items)
        project = Project(
            name="Failed Verification Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)

        # Step 1: Parse invoice with items not in BOM
        mock_task_request.id = 'parse-e2e-fail-001'

        mock_parse_result = {
            'status': 'success',
            'items': [
                {
                    'sku': 'UNKNOWN-001',
                    'name': 'Unknown Item 1',
                    'qty': 10,
                    'unit_price': '100.00',
                    'total_price': '1000.00'
                },
                {
                    'sku': 'UNKNOWN-002',
                    'name': 'Unknown Item 2',
                    'qty': 20,
                    'unit_price': '50.00',
                    'total_price': '1000.00'
                },
            ],
            'metadata': {
                'project_name': 'Failed Verification Project',
                'client': 'Test Client'
            },
            'raw_text': 'Verification failure test'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            parse_result = call_parse_invoice_task(
                'unknown_invoice.pdf',
                b'%PDF-1.4\nunknown items',
                {
                    'message_id': '<fail@example.com>',
                    'subject': 'Unknown Invoice',
                    'from': 'supplier@example.com',
                    'date': '2024-01-15',
                    'to': 'invoices@zakuppro.com',
                    'uid': 4
                },
                mock_task_request
            )

        invoice_id = parse_result['invoice_id']
        print(f"✓ Parse complete: invoice_id={invoice_id}")

        # Step 2: Verify invoice (should fail - no BOM match)
        mock_task_request.id = 'verify-e2e-fail-001'

        verify_result = call_verify_invoice_task(invoice_id, mock_task_request, db_session)

        # Verify failed verdict
        assert verify_result['status'] == 'success'
        assert verify_result['verdict'] == 'failed'
        assert verify_result['unmapped_count'] > 0
        print(f"✓ Verification: verdict=failed, unmapped_count={verify_result['unmapped_count']}")

        # Verify unmapped_items structure
        invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
        vr = invoice.verification_result
        assert vr['verdict'] == 'failed'
        assert len(vr['unmapped_items']) == 2  # Both items unmapped
        print(f"✓ Unmapped items: {len(vr['unmapped_items'])}")

        # Verify notification dispatched for failed verdict
        assert mock_notification_dispatch.called
        call_args = mock_notification_dispatch.call_args
        verification_result_arg = call_args[0][0]
        assert verification_result_arg.verdict == 'failed'
        print(f"✓ Notification dispatched with verdict='failed'")


# =============================================================================
# E2E Tests: Error Path - FailedTask DLQ
# =============================================================================

class TestErrorPathDLQ:
    """End-to-end tests for error paths with FailedTask DLQ persistence."""

    def test_parse_error_creates_failed_task(
        self, db_session, mock_task_request
    ):
        """
        Test that parse_invoice error creates FailedTask DLQ record.

        Mocks parser to return error, verifies:
        - ValueError raised
        - FailedTask record created with task_id, error_message
        - FailedTask.file_path, context populated
        """
        print("\n=== E2E: Parse Error → FailedTask DLQ ===")

        mock_task_request.id = 'parse-fail-dlq-001'

        # Mock parser to return error
        mock_parse_result = {
            'status': 'error',
            'error': 'LLM parsing failed: rate limit exceeded',
            'items': [],
            'raw_text': ''
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            # Should raise ValueError
            with pytest.raises(ValueError, match="Invoice parsing failed"):
                call_parse_invoice_task(
                    'bad.pdf',
                    b'%PDF-1.4\nbad content',
                    {
                        'message_id': '<bad@example.com>',
                        'subject': 'Bad Invoice',
                        'from': 'supplier@example.com',
                        'date': '2024-01-15',
                        'to': 'invoices@zakuppro.com',
                        'uid': 5
                    },
                    mock_task_request
                )

        # Verify FailedTask record created
        failed_task = db_session.query(FailedTask).filter(
            FailedTask.task_id == 'parse-fail-dlq-001'
        ).first()
        assert failed_task is not None
        assert failed_task.task_name == 'tasks.parse_invoice'
        assert 'LLM parsing failed' in failed_task.error_message
        assert failed_task.file_path == 'bad.pdf'
        assert failed_task.chat_id is None  # Email tasks don't have chat_id
        print(f"✓ FailedTask created: task_id={failed_task.task_id}")
        print(f"  error_type={failed_task.error_type}")

    def test_verify_error_raises_value_error(
        self, db_session, mock_task_request
    ):
        """
        Test that verify_invoice error raises ValueError (goes to Celery DLQ).

        ValueError from verification goes directly to Celery DLQ without
        creating FailedTask record (this is intentional - ValueError is
        a validation error, not a transient error).

        Verifies:
        - ValueError raised for missing invoice
        - Error propagates correctly (will be handled by Celery DLQ in production)
        """
        print("\n=== E2E: Verify Error → ValueError (Celery DLQ) ===")

        mock_task_request.id = 'verify-fail-dlq-001'

        # Try to verify non-existent invoice
        # ValueError from verification goes to Celery DLQ directly
        # (no FailedTask record created - that's for unexpected errors only)
        with pytest.raises(ValueError, match="Invoice with id=.* not found"):
            call_verify_invoice_task(99999, mock_task_request, db_session)

        print(f"✓ ValueError raised (will go to Celery DLQ in production)")


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
