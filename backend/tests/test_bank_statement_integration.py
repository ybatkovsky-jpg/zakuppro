"""
Integration tests for end-to-end bank statement flow.

Tests the complete flow:
IMAP receives email with .txt attachment -> Email Worker routes to parse_bank_statement
-> Task processes -> Data persisted to DB.

These tests verify the entire pipeline from fixture content to database persistence,
simulating what happens when a real email is processed by the system.
"""
import pytest
from decimal import Decimal
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch

# Import after adding project root to path
project_root = Path(__file__).parent.parent.parent
import sys
sys.path.insert(0, str(project_root))

from backend.models import BankStatement, BankTransaction


@pytest.fixture
def mock_task_request():
    """Mock Celery task request object for testing."""
    mock_req = Mock()
    mock_req.id = 'integration-test-task-001'
    mock_req.retries = 0
    return mock_req


@pytest.fixture
def sample_email_metadata():
    """Sample email metadata simulating IMAP email."""
    return {
        'message_id': '<test-tinkoff-statement@example.com>',
        'subject': 'Банковская выписка Тинькофф',
        'from': 'tinkoff@example.com',
        'date': 'Mon, 02 Jun 2026 10:00:00 +0000',
        'to': 'zakuppro@example.com',
        'uid': 12345
    }


@pytest.fixture
def sample_ozon_metadata():
    """Sample email metadata for Ozon bank statement."""
    return {
        'message_id': '<test-ozon-statement@example.com>',
        'subject': 'Выписка Озон Банк',
        'from': 'ozon@example.com',
        'date': 'Tue, 02 Jun 2026 11:30:00 +0000',
        'to': 'zakuppro@example.com',
        'uid': 12346
    }


@pytest.fixture
def tinkoff_fixture():
    """Load Tinkoff bank statement fixture."""
    fixture_path = project_root / "backend" / "tests" / "fixtures" / "tinkoff_statement.txt"
    with open(fixture_path, 'rb') as f:
        return f.read()


@pytest.fixture
def ozon_fixture():
    """Load Ozon bank statement fixture."""
    fixture_path = project_root / "backend" / "tests" / "fixtures" / "ozon_bank_statement.txt"
    with open(fixture_path, 'rb') as f:
        return f.read()


def call_parse_bank_statement_task(filename, file_content, metadata, task_request, db_session=None):
    """
    Helper function to call parse_bank_statement task business logic directly.

    Bypasses Celery task wrapper and BaseTask.run_with_context orchestration,
    calling the execute() method directly with the test DB session.
    """
    from backend.tasks import parse_bank_statement

    # Call execute() directly, bypassing run_with_context's DB session management
    return parse_bank_statement.execute(
        db_session,
        filename=filename,
        file_content=file_content,
        metadata=metadata,
    )


class TestBankStatementIntegration:
    """Integration tests for end-to-end bank statement processing flow."""

    def test_tinkoff_end_to_end_flow(
        self, db_session, mock_task_request, tinkoff_fixture, sample_email_metadata
    ):
        """
        Test complete end-to-end flow for Tinkoff bank statement.

        Simulates:
        1. IMAP receives email with Tinkoff .txt attachment
        2. parse_bank_statement Celery task processes the content
        3. Data is persisted to BankStatement and BankTransaction tables

        Verifies:
        - BankStatement record created with correct fields
        - 3 BankTransaction records created
        - Amounts, INNs, descriptions parsed correctly
        - BankStatement.status = 'Готов'
        """
        # Patch SessionLocal to use test session
        with patch('backend.database.SessionLocal', return_value=db_session):
            # Call parse_bank_statement task directly (simulating Celery execution)
            result = call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_email_metadata,
                mock_task_request,
                db_session=db_session
            )

            # Verify task result structure
            assert result['status'] == 'success'
            assert result['filename'] == 'tinkoff_statement.txt'
            assert result['bank_statement_id'] is not None
            assert result['transactions_count'] == 3
            assert result['message_id'] == '<test-tinkoff-statement@example.com>'
            # task_id may be None when calling execute() directly (no Celery context)
            assert 'task_id' in result

            # Verify BankStatement record was created
            statements = db_session.query(BankStatement).all()
            assert len(statements) == 1

            stmt = statements[0]
            assert stmt.bank_name == 'ТИНЬКОФФ БАНК'
            assert stmt.status == 'Готов'
            assert stmt.raw_file == tinkoff_fixture
            assert stmt.statement_date is not None
            assert stmt.period_start is not None
            assert stmt.period_end is not None

            # Verify BankTransaction records
            transactions = db_session.query(BankTransaction).filter_by(
                bank_statement_id=stmt.id
            ).order_by(BankTransaction.transaction_date).all()

            assert len(transactions) == 3

            # Verify first transaction (31.05.2026 - ordered ascending by date)
            txn1 = transactions[0]
            assert txn1.transaction_date == datetime(2026, 5, 31)
            assert txn1.amount == Decimal('250000.00')
            assert txn1.supplier_inn == '7701234567'
            assert 'материалы' in txn1.description
            assert txn1.operation_type == 'Покупка'

            # Verify second transaction (01.06.2026)
            txn2 = transactions[1]
            assert txn2.transaction_date == datetime(2026, 6, 1)
            assert txn2.amount == Decimal('85000.50')
            assert txn2.supplier_inn == '9876543210'
            assert 'комплектующие' in txn2.description
            assert txn2.operation_type == 'Покупка'

            # Verify third transaction (02.06.2026)
            txn3 = transactions[2]
            assert txn3.transaction_date == datetime(2026, 6, 2)
            assert txn3.amount == Decimal('150000.00')
            assert txn3.supplier_inn == '123456789012'
            assert 'товары по счету' in txn3.description
            assert txn3.operation_type == 'Покупка'

    def test_ozon_end_to_end_flow(
        self, db_session, mock_task_request, ozon_fixture, sample_ozon_metadata
    ):
        """
        Test complete end-to-end flow for Ozon bank statement.

        Simulates:
        1. IMAP receives email with Ozon .txt attachment
        2. parse_bank_statement Celery task processes the content
        3. Data is persisted to BankStatement and BankTransaction tables

        Verifies:
        - BankStatement record created with correct bank name
        - 3 BankTransaction records created
        - Field variations handled (Получатель1 instead of ПолучательИНН)
        - All amounts and INNs parsed correctly
        """
        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_parse_bank_statement_task(
                'ozon_bank_statement.txt',
                ozon_fixture,
                sample_ozon_metadata,
                mock_task_request,
                db_session=db_session
            )

            # Verify task result
            assert result['status'] == 'success'
            assert result['transactions_count'] == 3
            assert result['message_id'] == '<test-ozon-statement@example.com>'

            # Verify BankStatement record
            statements = db_session.query(BankStatement).all()
            assert len(statements) == 1

            stmt = statements[0]
            assert stmt.bank_name == 'АО "ОЗОН БАНК"'
            assert stmt.status == 'Готов'
            assert stmt.raw_file == ozon_fixture

            # Verify BankTransaction records
            # Use amount ordering since two transactions have the same date
            transactions = db_session.query(BankTransaction).filter_by(
                bank_statement_id=stmt.id
            ).order_by(BankTransaction.amount).all()

            assert len(transactions) == 3

            # Ozon statements use Получатель1 field for INN
            # Verify transaction amounts in ascending order
            txn1 = transactions[0]
            assert txn1.amount == Decimal('67500.25')
            assert txn1.transaction_date == datetime(2026, 6, 1)
            assert txn1.supplier_inn == '987654321098'
            assert 'Предоплата' in txn1.description

            txn2 = transactions[1]
            assert txn2.amount == Decimal('98000.75')
            assert txn2.transaction_date == datetime(2026, 6, 2)
            assert txn2.supplier_inn == '3210987654'
            assert 'металлопрокат' in txn2.description

            txn3 = transactions[2]
            assert txn3.amount == Decimal('125000.00')
            assert txn3.transaction_date == datetime(2026, 6, 2)
            assert txn3.supplier_inn == '6543210987'
            assert 'электрооборудование' in txn3.description

    def test_multiple_statements_isolated(
        self, db_session, mock_task_request, tinkoff_fixture, ozon_fixture,
        sample_email_metadata, sample_ozon_metadata
    ):
        """
        Test that processing multiple statements creates separate BankStatement records.

        Simulates processing two different bank statement emails in sequence.
        Verifies that each statement is stored independently with its transactions.
        """
        with patch('backend.database.SessionLocal', return_value=db_session):
            # Process Tinkoff statement
            call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_email_metadata,
                mock_task_request,
                db_session=db_session
            )

            # Process Ozon statement
            call_parse_bank_statement_task(
                'ozon_bank_statement.txt',
                ozon_fixture,
                sample_ozon_metadata,
                mock_task_request,
                db_session=db_session
            )

            # Verify two separate BankStatement records
            statements = db_session.query(BankStatement).order_by(BankStatement.id).all()
            assert len(statements) == 2

            # Verify different bank names
            bank_names = {stmt.bank_name for stmt in statements}
            assert 'ТИНЬКОФФ БАНК' in bank_names
            assert 'АО "ОЗОН БАНК"' in bank_names

            # Verify total transactions (3 from each statement)
            transactions = db_session.query(BankTransaction).all()
            assert len(transactions) == 6

            # Verify transactions are linked to correct statements
            stmt1, stmt2 = statements
            stmt1_txns = db_session.query(BankTransaction).filter_by(
                bank_statement_id=stmt1.id
            ).count()
            stmt2_txns = db_session.query(BankTransaction).filter_by(
                bank_statement_id=stmt2.id
            ).count()

            assert stmt1_txns == 3
            assert stmt2_txns == 3

    def test_transaction_relationship_consistency(
        self, db_session, mock_task_request, tinkoff_fixture, sample_email_metadata
    ):
        """
        Test that BankStatement -> BankTransaction relationship is bidirectional.

        Verifies ORM relationships work correctly after persistence.
        """
        with patch('backend.database.SessionLocal', return_value=db_session):
            call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_email_metadata,
                mock_task_request,
                db_session=db_session
            )

            # Query from BankStatement side
            stmt = db_session.query(BankStatement).first()
            assert len(stmt.transactions) == 3

            # Query from BankTransaction side
            txn = db_session.query(BankTransaction).first()
            assert txn.bank_statement is not None
            assert txn.bank_statement.id == stmt.id

            # Verify all transactions point to same statement
            for txn in stmt.transactions:
                assert txn.bank_statement_id == stmt.id

    def test_amount_precision_preserved(
        self, db_session, mock_task_request, ozon_fixture, sample_ozon_metadata
    ):
        """
        Test that decimal amounts are preserved with full precision.

        Important for financial data where precision matters.
        """
        with patch('backend.database.SessionLocal', return_value=db_session):
            call_parse_bank_statement_task(
                'ozon_bank_statement.txt',
                ozon_fixture,
                sample_ozon_metadata,
                mock_task_request,
                db_session=db_session
            )

            transactions = db_session.query(BankTransaction).order_by(
                BankTransaction.amount
            ).all()

            # Verify precise decimal values (not rounded)
            assert transactions[0].amount == Decimal('67500.25')
            assert transactions[1].amount == Decimal('98000.75')
            assert transactions[2].amount == Decimal('125000.00')

            # Verify amounts are Decimal type, not float
            for txn in transactions:
                assert isinstance(txn.amount, Decimal)

    def test_date_range_tracking(
        self, db_session, mock_task_request, tinkoff_fixture, sample_email_metadata
    ):
        """
        Test that statement date ranges are tracked correctly.

        Verifies period_start and period_end reflect actual transaction dates.
        """
        with patch('backend.database.SessionLocal', return_value=db_session):
            call_parse_bank_statement_task(
                'tinkoff_statement.txt',
                tinkoff_fixture,
                sample_email_metadata,
                mock_task_request,
                db_session=db_session
            )

            stmt = db_session.query(BankStatement).first()

            # Tinkoff fixture has transactions on 31.05, 01.06, 02.06
            # period_start is earliest date, period_end is latest date
            assert stmt.period_start == datetime(2026, 5, 31)
            assert stmt.period_end == datetime(2026, 6, 2)
            # statement_date should be the latest transaction date
            assert stmt.statement_date == datetime(2026, 6, 2)
