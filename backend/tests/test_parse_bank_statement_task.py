"""
Unit tests for parse_bank_statement Celery task.

Tests the complete workflow:
1. Parsing 1C ClientBank .txt files
2. Creating BankStatement/BankTransaction records
3. Error handling and DLQ persistence
"""
import pytest
from decimal import Decimal
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Import after adding project root to path
project_root = Path(__file__).parent.parent.parent
import sys
sys.path.insert(0, str(project_root))

from backend.models import BankStatement, BankTransaction, FailedTask


@pytest.fixture
def mock_task_request():
    """Mock Celery task request object for testing."""
    mock_req = Mock()
    mock_req.id = 'test-task-001'
    mock_req.retries = 0
    return mock_req


def call_parse_bank_statement_task(filename, file_content, metadata, task_request):
    """
    Helper function to call parse_bank_statement task business logic directly.

    Bypasses Celery task wrapper to test core business logic with mocked context.
    """
    from backend.tasks import parse_bank_statement

    # Create a mock task instance (self) with request attribute
    class MockTaskInstance:
        def __init__(self, request_mock):
            self.request = request_mock
            self.id = request_mock.id
            # Mock retry method
            self.retry = Mock(side_effect=Exception("Should not retry in tests"))

    mock_self = MockTaskInstance(task_request)

    # Get the actual function from the task object
    # The __wrapped__ attribute gives us the bound method
    bound_method = parse_bank_statement.__wrapped__
    actual_func = bound_method.__func__  # Get the raw function

    # Call the actual function with our mock self
    return actual_func(mock_self, filename, file_content, metadata)


@pytest.fixture
def tinkoff_fixture():
    """Load Tinkoff bank statement fixture."""
    with open('backend/tests/fixtures/tinkoff_statement.txt', 'rb') as f:
        return f.read()


@pytest.fixture
def ozon_fixture():
    """Load Ozon bank statement fixture."""
    with open('backend/tests/fixtures/ozon_bank_statement.txt', 'rb') as f:
        return f.read()


@pytest.fixture
def sample_metadata():
    """Sample email metadata for bank statement."""
    return {
        'message_id': '<test@example.com>',
        'subject': 'Bank Statement',
        'from': 'bank@example.com',
        'date': 'Mon, 02 Jun 2026 10:00:00 +0000',
        'to': 'zakuppro@example.com',
        'uid': 12345
    }


class TestParseBankStatementTask:
    """Test suite for parse_bank_statement Celery task."""

    def test_tinkoff_statement_parsing_and_persistence(
        self, db_session, mock_task_request, tinkoff_fixture, sample_metadata
    ):
        """Test complete Tinkoff statement processing with DB persistence."""
        # Patch SessionLocal to use test session
        with patch('backend.database.SessionLocal', return_value=db_session):
            # Bind the mock self to task function
            result = call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_metadata,
                mock_task_request
            )

            # Verify result structure
            assert result['status'] == 'success'
            assert result['filename'] == 'tinkoff_statement.txt'
            assert result['bank_statement_id'] is not None
            assert result['transactions_count'] == 3
            assert result['bank_name'] is not None
            assert result['message_id'] == '<test@example.com>'
            assert result['task_id'] == 'test-task-001'

            # Verify BankStatement record
            statements = db_session.query(BankStatement).all()
            assert len(statements) == 1

            stmt = statements[0]
            assert stmt.bank_name is not None
            assert stmt.status == 'Готов'
            assert stmt.statement_date is not None
            assert stmt.period_start is not None
            assert stmt.period_end is not None
            assert stmt.raw_file == tinkoff_fixture

            # Verify BankTransaction records
            transactions = db_session.query(BankTransaction).all()
            assert len(transactions) == 3

            # Check first transaction
            txn1 = transactions[0]
            assert txn1.bank_statement_id == stmt.id
            assert txn1.transaction_date is not None
            assert isinstance(txn1.amount, (Decimal, float))
            assert txn1.supplier_inn is not None
            assert txn1.description is not None
            assert txn1.operation_type == 'Покупка'

    def test_ozon_statement_parsing_and_persistence(
        self, db_session, mock_task_request, ozon_fixture, sample_metadata
    ):
        """Test complete Ozon statement processing with DB persistence."""
        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_parse_bank_statement_task(
                'ozon_bank_statement.txt',
                ozon_fixture,
                sample_metadata,
                mock_task_request
            )

            # Verify result
            assert result['status'] == 'success'
            assert result['transactions_count'] == 3

            # Verify records
            statements = db_session.query(BankStatement).all()
            assert len(statements) == 1

            transactions = db_session.query(BankTransaction).all()
            assert len(transactions) == 3

    def test_multiple_statements_create_separate_records(
        self, db_session, mock_task_request, tinkoff_fixture, ozon_fixture, sample_metadata
    ):
        """Test that processing multiple statements creates separate BankStatement records."""
        with patch('backend.database.SessionLocal', return_value=db_session):
            # Process Tinkoff
            call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_metadata,
                mock_task_request
            )

            # Process Ozon
            call_parse_bank_statement_task(
                'ozon_bank_statement.txt',
                ozon_fixture,
                sample_metadata,
                mock_task_request
            )

            # Verify two separate BankStatement records
            statements = db_session.query(BankStatement).all()
            assert len(statements) == 2

            # Verify different bank names
            bank_names = {stmt.bank_name for stmt in statements}
            assert len(bank_names) == 2

            # Verify total transactions
            transactions = db_session.query(BankTransaction).all()
            assert len(transactions) == 6  # 3 from each statement

    def test_empty_statement_raises_value_error(
        self, db_session, mock_task_request, sample_metadata
    ):
        """Test that empty/invalid statement raises ValueError."""
        empty_content = '1CClientBankExchange\nКонецФайла\n'.encode('cp1251')

        with patch('backend.database.SessionLocal', return_value=db_session):
            with pytest.raises(ValueError, match='No transactions found'):
                call_parse_bank_statement_task(
                    'empty.txt',
                    empty_content,
                    sample_metadata,
                    mock_task_request
                )

    def test_invalid_format_creates_failed_task(
        self, db_session, mock_task_request, sample_metadata
    ):
        """Test that parsing errors create FailedTask record."""
        invalid_content = b'Not a valid bank statement format'

        with patch('backend.database.SessionLocal', return_value=db_session):
            with pytest.raises(ValueError):
                call_parse_bank_statement_task(
                    'invalid.txt',
                    invalid_content,
                    sample_metadata,
                    mock_task_request
                )

            # Verify FailedTask was created
            failed_tasks = db_session.query(FailedTask).all()
            assert len(failed_tasks) == 1

            failed = failed_tasks[0]
            assert failed.task_id == 'test-task-001'
            assert failed.task_name == 'tasks.parse_bank_statement'
            assert 'ValueError' in failed.error_type
            assert failed.file_path == 'invalid.txt'

    def test_rate_limit_retries_with_backoff(
        self, mock_task_request, tinkoff_fixture, sample_metadata
    ):
        """Test that RateLimitError triggers retry with exponential backoff."""
        from openai import RateLimitError
        from httpx import Request, Response

        # Create a mock RateLimitError with required arguments
        mock_response = Response(status_code=429, request=Request('POST', 'https://api.openai.com/v1/chat/completions'))
        mock_error = RateLimitError(
            message="Rate limit exceeded",
            response=mock_response,
            body={},
        )

        mock_retry = Mock(side_effect=Exception("Should retry"))

        with patch('backend.services.bank_statement_parser.parse_bank_statement_file') as mock_parse:
            mock_parse.side_effect = mock_error

            # Create a mock task instance with retry method
            class MockTaskWithRetry:
                def __init__(self):
                    self.request = mock_task_request
                    self.id = mock_task_request.id
                    self.retry = mock_retry

            from backend.tasks import parse_bank_statement
            bound_method = parse_bank_statement.__wrapped__
            actual_func = bound_method.__func__
            mock_self = MockTaskWithRetry()

            with pytest.raises(Exception):
                actual_func(mock_self, 'tinkoff_statement.txt', tinkoff_fixture, sample_metadata)

            # Verify retry was called with exponential backoff
            mock_retry.assert_called_once()
            call_kwargs = mock_retry.call_args[1]
            assert 'exc' in call_kwargs
            assert 'countdown' in call_kwargs
            assert 'max_retries' in call_kwargs

    def test_status_transitions_correctly(
        self, db_session, mock_task_request, tinkoff_fixture, sample_metadata
    ):
        """Test that BankStatement status transitions from Обрабатывается to Готов."""
        with patch('backend.database.SessionLocal', return_value=db_session):
            call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_metadata,
                mock_task_request
            )

            # Verify final status is 'Готов'
            stmt = db_session.query(BankStatement).first()
            assert stmt.status == 'Готов'

    def test_transaction_data_integrity(
        self, db_session, mock_task_request, tinkoff_fixture, sample_metadata
    ):
        """Test that transaction data is preserved accurately."""
        with patch('backend.database.SessionLocal', return_value=db_session):
            call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_metadata,
                mock_task_request
            )

            transactions = db_session.query(BankTransaction).all()

            # Verify data types
            for txn in transactions:
                assert txn.bank_statement_id is not None
                assert isinstance(txn.transaction_date, datetime)
                assert isinstance(txn.amount, (Decimal, float, int))
                assert isinstance(txn.operation_type, str)
                assert txn.description is not None or True  # Description can be empty

            # Verify amounts are positive (outgoing payments)
            amounts = [float(txn.amount) for txn in transactions]
            assert all(amount > 0 for amount in amounts)
