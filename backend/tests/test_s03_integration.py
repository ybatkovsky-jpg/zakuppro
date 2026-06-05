"""
Integration tests for S03: Invoice parsing service with PDF/Excel support.

Tests the complete parse_invoice Celery task pipeline with mock LLM responses:
- Full task execution with mocked LLMProvider
- Invoice BLOB storage verification
- InvoiceItem creation with Decimal prices
- Supplier auto-creation from email metadata
- FailedTask DLQ handling on errors

Uses pytest fixtures for database and mock LLM to avoid real API calls.
"""

import os
import sys
import io
from pathlib import Path
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock

import pytest

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Use SQLite for testing (not production PostgreSQL)
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Import models after defining test Base
from backend.models import (
    Project, Supplier, PurchaseOrder, Invoice, InvoiceItem, FailedTask,
    ProjectItem, StockItem, Payment, UnresolvedTransaction, ProductionTask
)

# Import LLM types for fixtures
from backend.llm_provider import (
    ExtractedInvoice,
    InvoiceItem as LLMInvoiceItem,
    InvoiceMetadata,
)
from backend.services.invoice_parser import InvoiceParser

# Create a test SQLite engine
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

# Get the metadata from the actual models' Base
from backend.models import Base
TestBase = Base  # Use the actual Base with all models registered


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test using SQLite."""
    # Import models here to ensure they're registered with TestBase
    from backend.models import (
        Project, Supplier, PurchaseOrder, Invoice, InvoiceItem, FailedTask,
        ProjectItem, StockItem, Payment, UnresolvedTransaction, ProductionTask
    )

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


# Patch the database module to use test session
@pytest.fixture(scope="function", autouse=True)
def patch_database(db_session):
    """Patch backend.database to use test database session."""
    from backend import database

    original_session_local = database.SessionLocal
    database.SessionLocal = lambda: db_session

    yield

    database.SessionLocal = original_session_local


@pytest.fixture(scope="function")
def mock_llm_response():
    """Mock LLM response for invoice extraction."""
    return ExtractedInvoice(
        items=[
            LLMInvoiceItem(
                sku="ABC123",
                name="Test Product 1",
                qty=10,
                supplier=None
            ),
            LLMInvoiceItem(
                sku="DEF456",
                name="Test Product 2",
                qty=20,
                supplier="Test Supplier"
            ),
            LLMInvoiceItem(
                sku="GHI789",
                name="Test Product 3",
                qty=5,
                supplier=None
            ),
        ],
        metadata=InvoiceMetadata(
            project_name="Test Project",
            client="Test Client"
        )
    )


@pytest.fixture
def mock_llm_provider(mock_llm_response):
    """Create a mock LLM provider that returns predefined responses."""
    mock_provider = Mock()
    mock_provider.parse_invoice.return_value = mock_llm_response
    return mock_provider


@pytest.fixture
def sample_pdf_content():
    """Sample PDF file content (minimal valid PDF)."""
    # Minimal valid PDF header
    return b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000115 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n190\n%%EOF\n"


@pytest.fixture
def sample_excel_content():
    """Sample Excel file content."""
    # Minimal Excel file (XLSX) - this would be a real binary file
    # For testing, we'll use a bytes placeholder
    return b"PK\x03\x04" + b"\x00" * 100  # Minimal ZIP header (XLSX is a ZIP)


@pytest.fixture
def sample_invoice_markdown():
    """Sample invoice markdown for LLM parsing."""
    return """## Page 1

Invoice #12345
Date: 2024-01-15

| SKU | Name | Qty | Supplier |
|-----|------|-----|----------|
| ABC123 | Test Product 1 | 10 | |
| DEF456 | Test Product 2 | 20 | Test Supplier |
| GHI789 | Test Product 3 | 5 | |
"""


@pytest.fixture
def mock_task_request():
    """Mock Celery task request object for testing."""
    mock_req = Mock()
    mock_req.id = 'test-task-123'
    mock_req.retries = 0
    return mock_req


def call_parse_invoice_task(filename, file_content, metadata, task_request, db_session=None, use_run_with_context=False):
    """
    Helper function to call parse_invoice task business logic directly.

    By default, bypasses Celery task wrapper and calls execute() directly.
    When use_run_with_context=True, uses run_with_context for DLQ behavior.
    """
    from backend.tasks import parse_invoice

    if use_run_with_context:
        # Use run_with_context for DLQ persistence tests
        # We need to call the task via Celery's apply() which sets up request properly
        with patch('backend.database.SessionLocal', return_value=db_session), \
             patch('backend.telegram_notifier.send_dlq_alert'):
            result = parse_invoice.apply(
                args=['bad.pdf', file_content, metadata],
            )
            # Celery apply() returns AsyncResult; re-raise if failed
            if result.failed():
                result.get(propagate=True)
            return result.result
    else:
        # Call execute() directly, bypassing run_with_context's DB session management
        return parse_invoice.execute(
            db_session,
            filename=filename,
            file_content=file_content,
            metadata=metadata,
        )


# =============================================================================
# Test Classes
# =============================================================================

class TestInvoiceParserUnit:
    """Unit tests for InvoiceParser service."""

    def test_parse_file_with_mock_llm(self, mock_llm_provider, sample_invoice_markdown):
        """Test InvoiceParser.parse_file with mocked LLM."""
        parser = InvoiceParser(llm_provider=mock_llm_provider)

        # Mock the file extraction to return our markdown
        with patch.object(parser, '_extract_pdf_text', return_value=sample_invoice_markdown):
            result = parser.parse_file("test.pdf", b"fake content")

        assert result['status'] == 'success'
        assert len(result['items']) == 3
        assert result['items'][0]['sku'] == 'ABC123'
        assert result['items'][0]['name'] == 'Test Product 1'
        assert result['items'][1]['supplier'] == 'Test Supplier'

    def test_parse_file_unsupported_format(self, mock_llm_provider):
        """Test that unsupported file formats raise ValueError."""
        parser = InvoiceParser(llm_provider=mock_llm_provider)

        with pytest.raises(ValueError, match="Unsupported file format"):
            parser.parse_file("test.txt", b"content")

    def test_parse_file_empty_extraction(self, mock_llm_provider):
        """Test handling of files with no extracted text."""
        parser = InvoiceParser(llm_provider=mock_llm_provider)

        with patch.object(parser, '_extract_pdf_text', return_value=""):
            result = parser.parse_file("empty.pdf", b"content")

        assert result['status'] == 'error'
        assert 'No text extracted' in result['error']


class TestParseInvoiceTask:
    """Integration tests for parse_invoice Celery task."""

    def test_full_task_execution_with_pdf(
        self, db_session, mock_llm_response, sample_pdf_content, mock_task_request
    ):
        """Test full parse_invoice task execution with PDF file."""
        # Mock the InvoiceParser to return our test data
        mock_parse_result = {
            'status': 'success',
            'items': [
                {
                    'sku': 'ABC123',
                    'name': 'Test Product 1',
                    'qty': 10,
                    'unit_price': '100.50',
                    'total_price': '1005.00'
                },
                {
                    'sku': 'DEF456',
                    'name': 'Test Product 2',
                    'qty': 20,
                    'unit_price': '50.25',
                    'total_price': '1005.00'
                },
            ],
            'metadata': {
                'project_name': 'Test Project',
                'client': 'Test Client'
            },
            'raw_text': 'Sample extracted text'
        }

        # Patch both the InvoiceParser factory and SessionLocal to use test session
        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            # Call the task with mocked self context
            result = call_parse_invoice_task(
                'invoice.pdf', sample_pdf_content, {
                    'message_id': '<test@example.com>',
                    'subject': 'Test Invoice',
                    'from': 'supplier@example.com',
                    'date': 'Mon, 15 Jan 2024 10:00:00 +0000',
                    'to': 'invoices@zakuppro.com',
                    'uid': 12345
                },
                mock_task_request,
                db_session=db_session
            )

        # Verify result structure
        assert result['status'] == 'success'
        assert result['filename'] == 'invoice.pdf'
        assert 'invoice_id' in result
        assert result['items_count'] == 2
        assert result['message_id'] == '<test@example.com>'

        # Verify Invoice record in database
        invoice = db_session.query(Invoice).filter(
            Invoice.id == result['invoice_id']
        ).first()
        assert invoice is not None
        assert invoice.file_url == 'invoice.pdf'
        assert invoice.raw_file == sample_pdf_content  # BLOB storage verified
        assert invoice.status == 'Ожидает сверки'

        # Verify InvoiceItem records with Decimal prices
        items = db_session.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice.id
        ).all()
        assert len(items) == 2

        # Check first item
        item1 = next(i for i in items if i.sku == 'ABC123')
        assert item1.name == 'Test Product 1'
        assert item1.qty == 10
        assert isinstance(item1.unit_price, Decimal)
        assert item1.unit_price == Decimal('100.50')
        assert isinstance(item1.total_price, Decimal)
        assert item1.total_price == Decimal('1005.00')

        # Check second item
        item2 = next(i for i in items if i.sku == 'DEF456')
        assert item2.name == 'Test Product 2'
        assert item2.qty == 20
        assert item2.unit_price == Decimal('50.25')

    def test_supplier_auto_creation_from_email(
        self, db_session, mock_llm_response, sample_pdf_content, mock_task_request
    ):
        """Test that supplier is auto-created from email metadata."""
        mock_parse_result = {
            'status': 'success',
            'items': [{'sku': 'TEST', 'name': 'Test', 'qty': 1, 'unit_price': '10.00', 'total_price': '10.00'}],
            'metadata': {},
            'raw_text': 'text'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            result = call_parse_invoice_task(
                'invoice.pdf', sample_pdf_content,
                {
                    'message_id': '<test@example.com>',
                    'from': 'test-supplier@company.com',
                    'subject': 'Invoice',
                    'date': '2024-01-15',
                    'to': 'invoices@zakuppro.com',
                    'uid': 1
                },
                mock_task_request,
                db_session=db_session
            )

        # Verify supplier was auto-created
        supplier = db_session.query(Supplier).filter(
            Supplier.name == 'test-supplier'
        ).first()
        assert supplier is not None
        assert 'test-supplier' in supplier.email
        assert supplier.email.endswith('@placeholder.com')

        # Verify PurchaseOrder links to the supplier
        po = db_session.query(PurchaseOrder).first()
        assert po is not None
        assert po.supplier_id == supplier.id

    def test_failed_task_dlq_on_error(
        self, db_session, sample_pdf_content, mock_task_request
    ):
        """Test that FailedTask record is created on task error."""
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

            # Update task_request id for this test
            mock_task_request.id = 'failed-task-123'

            # Task should raise ValueError and create FailedTask via run_with_context
            with pytest.raises(ValueError, match="Invoice parsing failed"):
                call_parse_invoice_task(
                    'bad.pdf', sample_pdf_content,
                    {'message_id': '<msg@example.com>', 'from': 'x@y.com', 'subject': 'X', 'date': '2024-01-01', 'to': 'z@z.com', 'uid': 1},
                    mock_task_request,
                db_session=db_session,
                use_run_with_context=True,
            )

        # Verify FailedTask record was created
        failed_tasks = db_session.query(FailedTask).all()
        assert len(failed_tasks) >= 1
        failed_task = failed_tasks[-1]  # Get the latest one
        assert failed_task.task_name == 'tasks.parse_invoice'
        assert 'LLM parsing failed' in failed_task.error_message
        assert failed_task.file_path == 'bad.pdf'
        assert failed_task.chat_id is None  # Email tasks don't have chat_id

    def test_task_with_no_items_extracted(
        self, db_session, mock_llm_response, sample_pdf_content, mock_task_request
    ):
        """Test that task fails when no items are extracted."""
        mock_parse_result = {
            'status': 'success',
            'items': [],  # No items extracted
            'metadata': {},
            'raw_text': 'text but no items'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            mock_task_request.id = 'no-items-task'

            with pytest.raises(ValueError, match="No items extracted"):
                call_parse_invoice_task(
                    'empty.pdf', sample_pdf_content,
                    {'message_id': '<x@x.com>', 'from': 'x@y.com', 'subject': 'X', 'date': '2024-01-01', 'to': 'z@z.com', 'uid': 1},
                    mock_task_request,
                db_session=db_session
            )

    def test_invoice_item_decimal_precision(
        self, db_session, sample_pdf_content, mock_task_request
    ):
        """Test that InvoiceItem prices maintain Decimal precision."""
        # Use high-precision decimal values
        mock_parse_result = {
            'status': 'success',
            'items': [
                {
                    'sku': 'PRECISE',
                    'name': 'Precision Test',
                    'qty': 1,
                    'unit_price': '123.45',
                    'total_price': '123.45'
                },
                {
                    'sku': 'FRACTION',
                    'name': 'Fraction Test',
                    'qty': 3,
                    'unit_price': '33.33',
                    'total_price': '99.99'
                },
            ],
            'metadata': {},
            'raw_text': 'text'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            mock_task_request.id = 'decimal-test-task'

            result = call_parse_invoice_task(
                'precision.pdf', sample_pdf_content,
                {'message_id': '<x@x.com>', 'from': 'x@y.com', 'subject': 'X', 'date': '2024-01-01', 'to': 'z@z.com', 'uid': 1},
                mock_task_request,
                db_session=db_session
            )

        # Verify Decimal precision is maintained
        invoice_id = result['invoice_id']
        items = db_session.query(InvoiceItem).filter(
            InvoiceItem.invoice_id == invoice_id
        ).all()

        precise_item = next(i for i in items if i.sku == 'PRECISE')
        assert precise_item.unit_price == Decimal('123.45')
        assert precise_item.total_price == Decimal('123.45')

        fraction_item = next(i for i in items if i.sku == 'FRACTION')
        assert fraction_item.unit_price == Decimal('33.33')
        assert fraction_item.total_price == Decimal('99.99')
        assert fraction_item.qty == 3


class TestProjectAndPurchaseOrderLinking:
    """Tests for project and purchase order auto-creation."""

    def test_project_auto_creation_from_metadata(
        self, db_session, sample_pdf_content, mock_task_request
    ):
        """Test that project is auto-created from extracted metadata."""
        mock_parse_result = {
            'status': 'success',
            'items': [{'sku': 'X', 'name': 'X', 'qty': 1, 'unit_price': '10.00', 'total_price': '10.00'}],
            'metadata': {
                'project_name': 'Auto Project',
                'client': 'Auto Client'
            },
            'raw_text': 'text'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            mock_task_request.id = 'project-auto-task'

            result = call_parse_invoice_task(
                'invoice.pdf', sample_pdf_content,
                {'message_id': '<x@x.com>', 'from': 'supplier@test.com', 'subject': 'Inv', 'date': '2024-01-01', 'to': 'x@x.com', 'uid': 1},
                mock_task_request,
                db_session=db_session
            )

        # Verify project was created
        project = db_session.query(Project).filter(
            Project.name == 'Auto Project'
        ).first()
        assert project is not None
        assert project.client == 'Auto Client'
        assert project.status == 'Проектирование'

        # Verify invoice is linked through PO to project
        invoice = db_session.query(Invoice).filter(
            Invoice.id == result['invoice_id']
        ).first()
        po = db_session.query(PurchaseOrder).filter(
            PurchaseOrder.id == invoice.purchase_order_id
        ).first()
        assert po.project_id == project.id

    def test_purchase_order_auto_creation(
        self, db_session, sample_pdf_content, mock_task_request
    ):
        """Test that purchase order is auto-created for invoice."""
        # Create a project and supplier first
        project = Project(name='Existing Project', client='Test Client', status='Проектирование')
        db_session.add(project)
        db_session.commit()

        supplier = Supplier(name='test-supplier', email='test-supplier@test.com')
        db_session.add(supplier)
        db_session.commit()

        # Mock parse result that references the project
        mock_parse_result = {
            'status': 'success',
            'items': [{'sku': 'X', 'name': 'X', 'qty': 1, 'unit_price': '10.00', 'total_price': '10.00'}],
            'metadata': {'project_name': 'Existing Project', 'client': 'Test Client'},
            'raw_text': 'text'
        }

        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory, \
             patch('backend.database.SessionLocal', return_value=db_session):
            mock_parser = Mock()
            mock_parser.parse_file.return_value = mock_parse_result
            mock_factory.return_value = mock_parser

            mock_task_request.id = 'po-auto-task'

            result = call_parse_invoice_task(
                'invoice.pdf', sample_pdf_content,
                {'message_id': '<x@x.com>', 'from': 'test-supplier@test.com', 'subject': 'Inv', 'date': '2024-01-01', 'to': 'x@x.com', 'uid': 1},
                mock_task_request,
                db_session=db_session
            )

        # Verify PO was created and linked correctly
        # Re-query the objects since they may have been detached
        project = db_session.query(Project).filter(Project.name == 'Existing Project').first()
        supplier = db_session.query(Supplier).filter(Supplier.name == 'test-supplier').first()

        invoice = db_session.query(Invoice).filter(
            Invoice.id == result['invoice_id']
        ).first()
        po = db_session.query(PurchaseOrder).filter(
            PurchaseOrder.id == invoice.purchase_order_id
        ).first()
        assert po is not None
        assert po.project_id == project.id
        assert po.supplier_id == supplier.id
        assert po.status == 'Сформирован'


class TestErrorHandling:
    """Tests for error scenarios and edge cases."""

    def test_llm_rate_limit_error_handling(
        self, db_session, sample_pdf_content, mock_task_request
    ):
        """Test handling of LLM rate limit errors (should retry)."""
        from backend.llm_provider import LLMRateLimitError

        mock_parser = Mock()
        mock_parser.parse_file.side_effect = LLMRateLimitError("Rate limit exceeded")

        with patch('backend.services.invoice_parser.create_invoice_parser', return_value=mock_parser), \
             patch('backend.database.SessionLocal', return_value=db_session):

            mock_task_request.id = 'rate-limit-task'
            mock_task_request.retries = 0

            # LLMRateLimitError should be raised (retry handling is in Celery framework)
            with pytest.raises(LLMRateLimitError, match="Rate limit exceeded"):
                call_parse_invoice_task(
                    'invoice.pdf', sample_pdf_content,
                    {'message_id': '<x@x.com>', 'from': 'x@y.com', 'subject': 'X', 'date': '2024-01-01', 'to': 'z@z.com', 'uid': 1},
                    mock_task_request,
                db_session=db_session
            )

    def test_unsupported_file_format_error(
        self, db_session, mock_task_request
    ):
        """Test that unsupported file formats are rejected early."""
        with patch('backend.services.invoice_parser.create_invoice_parser') as mock_factory:
            mock_parser = Mock()
            mock_parser.parse_file.side_effect = ValueError("Unsupported file format: .txt")
            mock_factory.return_value = mock_parser

            mock_task_request.id = 'bad-format-task'

            with pytest.raises(ValueError, match="Unsupported file format"):
                call_parse_invoice_task(
                    'document.txt', b'content',
                    {'message_id': '<x@x.com>', 'from': 'x@y.com', 'subject': 'X', 'date': '2024-01-01', 'to': 'z@z.com', 'uid': 1},
                    mock_task_request,
                db_session=db_session
            )


# =============================================================================
# Main entry point for running tests directly
# =============================================================================

if __name__ == "__main__":
    # Allow running tests directly with pytest
    pytest.main([__file__, "-v", "--tb=short"])
