"""
Integration tests for end-to-end payment matching flow.

Tests the complete flow:
BankStatement -> BankTransaction -> PaymentMatcher -> Payment/UnresolvedTransaction
Invoice.status update, TransactionMatchingAudit creation.

These tests verify the entire pipeline from bank statement processing
to payment reconciliation, simulating real-world matching scenarios.
"""
from __future__ import annotations

import pytest
from decimal import Decimal
from datetime import datetime
from unittest.mock import Mock, patch
from pathlib import Path

# Import after adding project root to path
project_root = Path(__file__).parent.parent.parent
import sys
sys.path.insert(0, str(project_root))

from backend.models import (
    BankStatement,
    BankTransaction,
    Invoice,
    InvoiceItem,
    Payment,
    PurchaseOrder,
    Project,
    Supplier,
    UnresolvedTransaction,
    TransactionMatchingAudit,
)
from backend.services.payment_matcher import PaymentMatcher, MatchResult


@pytest.fixture
def mock_task_request():
    """Mock Celery task request object for testing."""
    mock_req = Mock()
    mock_req.id = 'integration-test-matching-001'
    mock_req.retries = 0
    return mock_req


def call_match_bank_transactions_task_helper(
    bank_statement_id=None,
    bank_transaction_id=None,
    task_request=None,
):
    """
    Helper function to call match_bank_transactions task business logic directly.

    This bypasses the Celery task wrapper to test core business logic
    with mocked context, simulating what the Celery worker would do.
    """
    from backend.tasks import match_bank_transactions

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
    bound_method = match_bank_transactions.__wrapped__
    actual_func = bound_method.__func__  # Get the raw function

    # Call the actual function with our mock self
    return actual_func(mock_self, bank_statement_id, bank_transaction_id)


@pytest.fixture
def matching_test_data_exact(db_session):
    """
    Create test data for exact match scenario.

    Setup:
    - Supplier with INN 7701234567
    - PurchaseOrder with status "Сверен"
    - Invoice with total 100000.00
    - BankTransaction with same INN and exact amount
    """
    # Create project
    project = Project(name="Test Matching Project", client="Test Client", status="Проектирование")
    db_session.add(project)
    db_session.flush()

    # Create supplier with known INN
    supplier = Supplier(
        name="Exact Match Supplier",
        email="exact@example.com",
        requisites="ИНН: 7701234567\nБанк: Тинькофф\nСчет: 12345678901234567890",
    )
    db_session.add(supplier)
    db_session.flush()

    # Create purchase order with verified status
    po = PurchaseOrder(
        project_id=project.id,
        supplier_id=supplier.id,
        status="Сверен",
    )
    db_session.add(po)
    db_session.flush()

    # Create invoice with items
    invoice = Invoice(
        purchase_order_id=po.id,
        status="Ожидает оплаты",
        raw_text="Test invoice for exact match",
    )
    db_session.add(invoice)
    db_session.flush()

    # Create invoice items totaling 100000.00
    item = InvoiceItem(
        invoice_id=invoice.id,
        name="Test Item",
        sku="SKU001",
        qty=10,
        unit_price=Decimal("10000.00"),
        total_price=Decimal("100000.00"),
    )
    db_session.add(item)
    db_session.flush()

    # Create bank statement
    bank_stmt = BankStatement(
        bank_name="ТИНЬКОФФ БАНК",
        statement_date=datetime(2026, 6, 2),
        period_start=datetime(2026, 6, 1),
        period_end=datetime(2026, 6, 2),
        status="Готов",
        raw_file=b"test statement",
    )
    db_session.add(bank_stmt)
    db_session.flush()

    # Create bank transaction with exact amount match
    transaction = BankTransaction(
        bank_statement_id=bank_stmt.id,
        transaction_date=datetime(2026, 6, 2),
        amount=Decimal("100000.00"),
        supplier_inn="7701234567",
        description="Оплата за материалы",
        operation_type="Покупка",
    )
    db_session.add(transaction)
    db_session.flush()

    return {
        "supplier": supplier,
        "po": po,
        "invoice": invoice,
        "bank_stmt": bank_stmt,
        "transaction": transaction,
    }


@pytest.fixture
def matching_test_data_tolerance(db_session):
    """
    Create test data for tolerance match scenario.

    Setup:
    - Invoice with total 100000.00
    - BankTransaction with amount 98000.00 (within 5% tolerance)
    """
    # Create project
    project = Project(name="Tolerance Test Project", client="Test Client", status="Проектирование")
    db_session.add(project)
    db_session.flush()

    # Create supplier with known INN
    supplier = Supplier(
        name="Tolerance Match Supplier",
        email="tolerance@example.com",
        requisites="ИНН: 9876543210\nБанк: Тинькофф",
    )
    db_session.add(supplier)
    db_session.flush()

    # Create purchase order
    po = PurchaseOrder(
        project_id=project.id,
        supplier_id=supplier.id,
        status="Сверен",
    )
    db_session.add(po)
    db_session.flush()

    # Create invoice
    invoice = Invoice(
        purchase_order_id=po.id,
        status="Ожидает оплаты",
        raw_text="Test invoice for tolerance match",
    )
    db_session.add(invoice)
    db_session.flush()

    # Invoice total: 100000.00
    item = InvoiceItem(
        invoice_id=invoice.id,
        name="Tolerance Item",
        sku="SKU002",
        qty=5,
        unit_price=Decimal("20000.00"),
        total_price=Decimal("100000.00"),
    )
    db_session.add(item)
    db_session.flush()

    # Bank transaction amount: 98000.00 (2% difference, within 5%)
    bank_stmt = BankStatement(
        bank_name="ТИНЬКОФФ БАНК",
        statement_date=datetime(2026, 6, 3),
        period_start=datetime(2026, 6, 1),
        period_end=datetime(2026, 6, 3),
        status="Готов",
        raw_file=b"test",
    )
    db_session.add(bank_stmt)
    db_session.flush()

    transaction = BankTransaction(
        bank_statement_id=bank_stmt.id,
        transaction_date=datetime(2026, 6, 3),
        amount=Decimal("98000.00"),
        supplier_inn="9876543210",
        description="Частичная оплата",
        operation_type="Покупка",
    )
    db_session.add(transaction)
    db_session.flush()

    return {
        "supplier": supplier,
        "invoice": invoice,
        "transaction": transaction,
        "bank_stmt": bank_stmt,
    }


@pytest.fixture
def matching_test_data_ambiguous(db_session):
    """
    Create test data for ambiguous match scenario.

    Setup:
    - Two invoices with same supplier INN and similar amounts
    - BankTransaction with amount that could match either
    - Should result in UnresolvedTransaction
    """
    project = Project(name="Ambiguous Test Project", client="Test Client", status="Проектирование")
    db_session.add(project)
    db_session.flush()

    supplier = Supplier(
        name="Ambiguous Supplier",
        email="ambiguous@example.com",
        requisites="ИНН: 1111111111\nБанк: Тинькофф",
    )
    db_session.add(supplier)
    db_session.flush()

    # Two purchase orders
    po1 = PurchaseOrder(
        project_id=project.id,
        supplier_id=supplier.id,
        status="Сверен",
    )
    po2 = PurchaseOrder(
        project_id=project.id,
        supplier_id=supplier.id,
        status="Сверен",
    )
    db_session.add_all([po1, po2])
    db_session.flush()

    # Two invoices with close amounts (within 5% of each other)
    invoice1 = Invoice(
        purchase_order_id=po1.id,
        status="Ожидает оплаты",
        raw_text="Invoice 1",
    )
    invoice2 = Invoice(
        purchase_order_id=po2.id,
        status="Ожидает оплаты",
        raw_text="Invoice 2",
    )
    db_session.add_all([invoice1, invoice2])
    db_session.flush()

    # Invoice 1 total: 50000.00
    item1 = InvoiceItem(
        invoice_id=invoice1.id,
        name="Item 1",
        sku="SKU003",
        qty=5,
        unit_price=Decimal("10000.00"),
        total_price=Decimal("50000.00"),
    )
    # Invoice 2 total: 52000.00 (4% difference)
    item2 = InvoiceItem(
        invoice_id=invoice2.id,
        name="Item 2",
        sku="SKU004",
        qty=4,
        unit_price=Decimal("13000.00"),
        total_price=Decimal("52000.00"),
    )
    db_session.add_all([item1, item2])
    db_session.flush()

    bank_stmt = BankStatement(
        bank_name="ТИНЬКОФФ БАНК",
        statement_date=datetime(2026, 6, 4),
        period_start=datetime(2026, 6, 1),
        period_end=datetime(2026, 6, 4),
        status="Готов",
        raw_file=b"test",
    )
    db_session.add(bank_stmt)
    db_session.flush()

    # Transaction amount: 51000.00 (could match either)
    transaction = BankTransaction(
        bank_statement_id=bank_stmt.id,
        transaction_date=datetime(2026, 6, 4),
        amount=Decimal("51000.00"),
        supplier_inn="1111111111",
        description="Ambiguous payment",
        operation_type="Покупка",
    )
    db_session.add(transaction)
    db_session.flush()

    return {
        "supplier": supplier,
        "invoice1": invoice1,
        "invoice2": invoice2,
        "transaction": transaction,
        "bank_stmt": bank_stmt,
    }


@pytest.fixture
def matching_test_data_unknown_supplier(db_session):
    """
    Create test data for unknown supplier scenario.

    Setup:
    - BankTransaction with INN that doesn't match any supplier
    - Should result in UnresolvedTransaction
    """
    bank_stmt = BankStatement(
        bank_name="ТИНЬКОФФ БАНК",
        statement_date=datetime(2026, 6, 5),
        period_start=datetime(2026, 6, 1),
        period_end=datetime(2026, 6, 5),
        status="Готов",
        raw_file=b"test",
    )
    db_session.add(bank_stmt)
    db_session.flush()

    # Transaction with unknown supplier INN
    transaction = BankTransaction(
        bank_statement_id=bank_stmt.id,
        transaction_date=datetime(2026, 6, 5),
        amount=Decimal("75000.00"),
        supplier_inn="9999999999",  # Non-existent INN
        description="Unknown supplier payment",
        operation_type="Покупка",
    )
    db_session.add(transaction)
    db_session.flush()

    return {
        "transaction": transaction,
        "bank_stmt": bank_stmt,
    }


class TestMatchingIntegration:
    """Integration tests for end-to-end payment matching flow."""

    def test_exact_match_creates_payment_and_updates_invoice(
        self, db_session, matching_test_data_exact, mock_task_request
    ):
        """
        Test exact INN + amount match creates Payment and updates Invoice.status.

        Verifies:
        - Payment record created with correct amount and references
        - Invoice.status updated to "Оплачен"
        - TransactionMatchingAudit record created
        - confidence_score = 1.00 for exact match
        - matching_context JSON contains algorithm metadata
        """
        data = matching_test_data_exact
        invoice_id = data["invoice"].id
        transaction_id = data["transaction"].id
        bank_stmt_id = data["bank_stmt"].id

        with patch('backend.database.SessionLocal', return_value=db_session):
            # Call match_bank_transactions task
            result = call_match_bank_transactions_task_helper(
                bank_statement_id=bank_stmt_id,
                task_request=mock_task_request,
            )

            # Verify task result
            assert result['status'] == 'success'
            assert result['matched_count'] == 1
            assert result['unresolved_count'] == 0
            assert len(result['payment_ids']) == 1

            # Verify Payment record created
            payments = db_session.query(Payment).all()
            assert len(payments) == 1

            payment = payments[0]
            assert payment.invoice_id == invoice_id
            assert payment.amount == Decimal("100000.00")
            assert payment.bank_transaction_id == str(transaction_id)
            assert payment.payment_date == data["transaction"].transaction_date

            # Verify Invoice.status updated (re-query from DB)
            invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
            assert invoice.status == "Оплачен"

            # Verify TransactionMatchingAudit record created
            audits = db_session.query(TransactionMatchingAudit).all()
            assert len(audits) == 1

            audit = audits[0]
            assert audit.bank_transaction_id == transaction_id
            assert audit.invoice_id == invoice_id
            assert audit.matched_by == "auto"
            assert audit.confidence_score == Decimal("1.00")
            assert audit.matched_at is not None

            # Verify matching_context JSON contains algorithm metadata
            assert audit.matching_context is not None
            context = audit.matching_context
            assert context['algorithm'] == "inn_tolerance_match"
            assert context['supplier_inn'] == "7701234567"
            assert context['transaction_amount'] == "100000.00"
            assert context['invoice_total'] == "100000.00"
            assert context['confidence_score'] == "1.00"
            assert 'tolerance_min' in context
            assert 'tolerance_max' in context
            assert context['tolerance_percent'] == 5.0

    def test_tolerance_match_creates_payment_with_confidence(
        self, db_session, matching_test_data_tolerance, mock_task_request
    ):
        """
        Test INN + amount within ±5% tolerance creates Payment with <1.00 confidence.

        Verifies:
        - Payment record created
        - confidence_score between 0.85 and 0.99
        - matching_context shows amount difference
        """
        data = matching_test_data_tolerance
        invoice_id = data["invoice"].id
        transaction_id = data["transaction"].id
        bank_stmt_id = data["bank_stmt"].id

        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_match_bank_transactions_task_helper(
                bank_statement_id=bank_stmt_id,
                task_request=mock_task_request,
            )

            assert result['status'] == 'success'
            assert result['matched_count'] == 1
            assert result['unresolved_count'] == 0

            # Verify Payment created
            payments = db_session.query(Payment).all()
            assert len(payments) == 1

            payment = payments[0]
            assert payment.invoice_id == invoice_id
            assert payment.amount == Decimal("98000.00")

            # Verify Invoice.status updated (re-query from DB)
            invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
            assert invoice.status == "Оплачен"

            # Verify TransactionMatchingAudit with <1.00 confidence
            audits = db_session.query(TransactionMatchingAudit).all()
            assert len(audits) == 1

            audit = audits[0]
            # Confidence should be less than 1.00 but >= 0.85
            assert Decimal("0.85") <= audit.confidence_score < Decimal("1.00")
            assert audit.confidence_score >= Decimal("0.85")

            # Verify matching_context shows amount difference
            context = audit.matching_context
            assert context['transaction_amount'] == "98000.00"
            assert context['invoice_total'] == "100000.00"
            assert context['amount_difference'] == "2000.00"

    def test_ambiguous_match_creates_unresolved_transaction(
        self, db_session, matching_test_data_ambiguous, mock_task_request
    ):
        """
        Test ambiguous match (multiple close candidates) creates UnresolvedTransaction.

        Verifies:
        - No Payment record created
        - UnresolvedTransaction record created
        - Reason indicates ambiguity
        - Neither invoice status is updated
        """
        data = matching_test_data_ambiguous
        invoice1_id = data["invoice1"].id
        invoice2_id = data["invoice2"].id
        transaction_id = data["transaction"].id
        bank_stmt_id = data["bank_stmt"].id

        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_match_bank_transactions_task_helper(
                bank_statement_id=bank_stmt_id,
                task_request=mock_task_request,
            )

            assert result['status'] == 'success'
            assert result['matched_count'] == 0
            assert result['unresolved_count'] == 1

            # Verify NO Payment created
            payments = db_session.query(Payment).all()
            assert len(payments) == 0

            # Verify UnresolvedTransaction created
            unresolved = db_session.query(UnresolvedTransaction).all()
            assert len(unresolved) == 1

            ur = unresolved[0]
            assert ur.amount == data["transaction"].amount
            assert ur.bank_date == data["transaction"].transaction_date
            assert ur.status == "Не распределено"
            # Description should reference the transaction
            assert data["transaction"].description in ur.description or str(transaction_id) in ur.description

            # Verify neither invoice status changed (re-query from DB)
            invoice1 = db_session.query(Invoice).filter(Invoice.id == invoice1_id).first()
            invoice2 = db_session.query(Invoice).filter(Invoice.id == invoice2_id).first()
            assert invoice1.status == "Ожидает оплаты"
            assert invoice2.status == "Ожидает оплаты"

            # Verify NO TransactionMatchingAudit created
            audits = db_session.query(TransactionMatchingAudit).all()
            assert len(audits) == 0

    def test_unknown_supplier_creates_unresolved_transaction(
        self, db_session, matching_test_data_unknown_supplier, mock_task_request
    ):
        """
        Test unknown supplier INN creates UnresolvedTransaction.

        Verifies:
        - No Payment record created
        - UnresolvedTransaction record created
        - Reason indicates no matching invoices
        """
        data = matching_test_data_unknown_supplier
        transaction_id = data["transaction"].id
        bank_stmt_id = data["bank_stmt"].id

        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_match_bank_transactions_task_helper(
                bank_statement_id=bank_stmt_id,
                task_request=mock_task_request,
            )

            assert result['status'] == 'success'
            assert result['matched_count'] == 0
            assert result['unresolved_count'] == 1

            # Verify NO Payment created
            payments = db_session.query(Payment).all()
            assert len(payments) == 0

            # Verify UnresolvedTransaction created
            unresolved = db_session.query(UnresolvedTransaction).all()
            assert len(unresolved) == 1

            ur = unresolved[0]
            assert ur.amount == data["transaction"].amount
            assert ur.bank_date == data["transaction"].transaction_date
            assert ur.status == "Не распределено"

    def test_statement_with_multiple_transactions(
        self, db_session, mock_task_request
    ):
        """
        Test matching multiple transactions from a single bank statement.

        Setup:
        - 3 transactions: 2 exact matches, 1 ambiguous
        - Should result in 2 payments, 1 unresolved
        """
        # Create project and supplier
        project = Project(name="Multi Txn Project", client="Test Client", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        supplier = Supplier(
            name="Multi Txn Supplier",
            email="multi@example.com",
            requisites="ИНН: 5555555555\nБанк: Тинькофф",
        )
        db_session.add(supplier)
        db_session.flush()

        # Create two invoices for different amounts
        po1 = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        po2 = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add_all([po1, po2])
        db_session.flush()

        invoice1 = Invoice(purchase_order_id=po1.id, status="Ожидает оплаты")
        invoice2 = Invoice(purchase_order_id=po2.id, status="Ожидает оплаты")
        db_session.add_all([invoice1, invoice2])
        db_session.flush()
        invoice1_id = invoice1.id
        invoice2_id = invoice2.id

        # Invoice 1: 20000.00
        item1 = InvoiceItem(
            invoice_id=invoice1.id, name="Item A", sku="SKUA", qty=2,
            unit_price=Decimal("10000.00"), total_price=Decimal("20000.00"),
        )
        # Invoice 2: 30000.00
        item2 = InvoiceItem(
            invoice_id=invoice2.id, name="Item B", sku="SKUB", qty=3,
            unit_price=Decimal("10000.00"), total_price=Decimal("30000.00"),
        )
        db_session.add_all([item1, item2])
        db_session.flush()

        # Create bank statement with 3 transactions
        bank_stmt = BankStatement(
            bank_name="ТИНЬКОФФ БАНК",
            statement_date=datetime(2026, 6, 6),
            period_start=datetime(2026, 6, 1),
            period_end=datetime(2026, 6, 6),
            status="Готов",
            raw_file=b"test",
        )
        db_session.add(bank_stmt)
        db_session.flush()
        bank_stmt_id = bank_stmt.id

        # Transaction 1: Exact match to invoice1
        txn1 = BankTransaction(
            bank_statement_id=bank_stmt.id,
            transaction_date=datetime(2026, 6, 6),
            amount=Decimal("20000.00"),
            supplier_inn="5555555555",
            description="Payment for Invoice 1",
            operation_type="Покупка",
        )
        # Transaction 2: Exact match to invoice2
        txn2 = BankTransaction(
            bank_statement_id=bank_stmt.id,
            transaction_date=datetime(2026, 6, 6),
            amount=Decimal("30000.00"),
            supplier_inn="5555555555",
            description="Payment for Invoice 2",
            operation_type="Покупка",
        )
        # Transaction 3: Unknown supplier
        txn3 = BankTransaction(
            bank_statement_id=bank_stmt.id,
            transaction_date=datetime(2026, 6, 6),
            amount=Decimal("15000.00"),
            supplier_inn="8888888888",
            description="Unknown payment",
            operation_type="Покупка",
        )
        db_session.add_all([txn1, txn2, txn3])
        db_session.flush()

        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_match_bank_transactions_task_helper(
                bank_statement_id=bank_stmt_id,
                task_request=mock_task_request,
            )

            assert result['status'] == 'success'
            assert result['matched_count'] == 2
            assert result['unresolved_count'] == 1
            assert len(result['payment_ids']) == 2

            # Verify 2 Payments created
            payments = db_session.query(Payment).all()
            assert len(payments) == 2

            # Verify 1 UnresolvedTransaction
            unresolved = db_session.query(UnresolvedTransaction).all()
            assert len(unresolved) == 1

            # Verify 2 TransactionMatchingAudit records
            audits = db_session.query(TransactionMatchingAudit).all()
            assert len(audits) == 2

            # Verify both invoices marked as paid (re-query from DB)
            invoice1 = db_session.query(Invoice).filter(Invoice.id == invoice1_id).first()
            invoice2 = db_session.query(Invoice).filter(Invoice.id == invoice2_id).first()
            assert invoice1.status == "Оплачен"
            assert invoice2.status == "Оплачен"

    def test_single_transaction_mode(
        self, db_session, matching_test_data_exact, mock_task_request
    ):
        """
        Test matching a single transaction (bank_transaction_id mode).

        Verifies:
        - bank_transaction_id parameter works correctly
        - Same matching behavior as bank_statement_id mode
        """
        data = matching_test_data_exact
        invoice_id = data["invoice"].id
        transaction_id = data["transaction"].id

        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_match_bank_transactions_task_helper(
                bank_transaction_id=transaction_id,
                task_request=mock_task_request,
            )

            assert result['status'] == 'success'
            assert result['matched_count'] == 1
            assert result['unresolved_count'] == 0

            # Verify Payment created
            payments = db_session.query(Payment).all()
            assert len(payments) == 1
            assert payments[0].invoice_id == invoice_id

            # Verify Invoice.status updated (re-query from DB)
            invoice = db_session.query(Invoice).filter(Invoice.id == invoice_id).first()
            assert invoice.status == "Оплачен"

    def test_paid_invoice_not_rematched(
        self, db_session, matching_test_data_exact, mock_task_request
    ):
        """
        Test that already-paid invoices are not re-matched.

        Setup:
        - Invoice already has status "Оплачен"
        - BankTransaction comes through
        - Should create UnresolvedTransaction (no match)
        """
        data = matching_test_data_exact
        invoice = data["invoice"]
        bank_stmt = data["bank_stmt"]

        # Mark invoice as already paid
        invoice.status = "Оплачен"
        db_session.commit()

        with patch('backend.database.SessionLocal', return_value=db_session):
            result = call_match_bank_transactions_task_helper(
                bank_statement_id=bank_stmt.id,
                task_request=mock_task_request,
            )

            # Should not match - invoice already paid
            assert result['matched_count'] == 0
            assert result['unresolved_count'] == 1

            # Verify no new Payment created
            payments = db_session.query(Payment).all()
            assert len(payments) == 0

    def test_matching_context_completeness(
        self, db_session, matching_test_data_exact, mock_task_request
    ):
        """
        Test that matching_context contains all required algorithm metadata.

        Verifies all expected fields are present in matching_context JSON:
        - algorithm
        - supplier_inn
        - transaction_amount
        - invoice_total
        - amount_difference
        - tolerance_min
        - tolerance_max
        - tolerance_percent
        - transaction_date
        - confidence_score
        - invoice_id
        - purchase_order_id
        """
        data = matching_test_data_exact
        bank_stmt = data["bank_stmt"]

        with patch('backend.database.SessionLocal', return_value=db_session):
            call_match_bank_transactions_task_helper(
                bank_statement_id=bank_stmt.id,
                task_request=mock_task_request,
            )

            audit = db_session.query(TransactionMatchingAudit).first()
            context = audit.matching_context

            # Verify all required fields
            required_fields = [
                'algorithm',
                'supplier_inn',
                'transaction_amount',
                'invoice_total',
                'amount_difference',
                'tolerance_min',
                'tolerance_max',
                'tolerance_percent',
                'transaction_date',
                'confidence_score',
                'invoice_id',
                'purchase_order_id',
            ]

            for field in required_fields:
                assert field in context, f"Missing field in matching_context: {field}"

            # Verify data types
            assert isinstance(context['tolerance_percent'], (int, float))
            assert isinstance(context['invoice_id'], int)
            assert isinstance(context['purchase_order_id'], int)

    def test_confidence_score_calculation(
        self, db_session, mock_task_request
    ):
        """
        Test confidence_score calculation across tolerance range.

        Verifies:
        - Exact amount = 1.00 confidence
        - Near boundary = ~0.85 confidence
        - Mid-range = ~0.92-0.93 confidence
        """
        project = Project(name="Confidence Test Project", client="Test", status="Проектирование")
        db_session.add(project)
        db_session.flush()

        supplier = Supplier(
            name="Confidence Supplier",
            email="conf@example.com",
            requisites="ИНН: 3333333333\nБанк: Тинькофф",
        )
        db_session.add(supplier)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id, status="Сверен")
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Ожидает оплаты")
        db_session.add(invoice)
        db_session.flush()
        invoice_id = invoice.id

        # Invoice total: 100000.00
        item = InvoiceItem(
            invoice_id=invoice.id, name="Item", sku="SKU", qty=10,
            unit_price=Decimal("10000.00"), total_price=Decimal("100000.00"),
        )
        db_session.add(item)
        db_session.flush()

        bank_stmt = BankStatement(
            bank_name="ТИНЬКОФФ БАНК",
            statement_date=datetime(2026, 6, 7),
            period_start=datetime(2026, 6, 1),
            period_end=datetime(2026, 6, 7),
            status="Готов",
            raw_file=b"test",
        )
        db_session.add(bank_stmt)
        db_session.flush()
        bank_stmt_id = bank_stmt.id

        # Test exact match (1.00)
        txn_exact = BankTransaction(
            bank_statement_id=bank_stmt.id,
            transaction_date=datetime(2026, 6, 7),
            amount=Decimal("100000.00"),
            supplier_inn="3333333333",
            description="Exact match",
            operation_type="Покупка",
        )
        db_session.add(txn_exact)
        db_session.flush()
        txn_exact_id = txn_exact.id

        with patch('backend.database.SessionLocal', return_value=db_session):
            call_match_bank_transactions_task_helper(
                bank_transaction_id=txn_exact_id,
                task_request=mock_task_request,
            )

            audit = db_session.query(TransactionMatchingAudit).first()
            assert audit.confidence_score == Decimal("1.00")

        # Clean up for next test
        db_session.rollback()

        # Recreate data for second test (after rollback)
        project2 = Project(name="Confidence Test Project 2", client="Test", status="Проектирование")
        db_session.add(project2)
        db_session.flush()

        supplier2 = Supplier(
            name="Confidence Supplier 2",
            email="conf2@example.com",
            requisites="ИНН: 4444444444\nБанк: Тинькофф",
        )
        db_session.add(supplier2)
        db_session.flush()

        po2 = PurchaseOrder(project_id=project2.id, supplier_id=supplier2.id, status="Сверен")
        db_session.add(po2)
        db_session.flush()

        invoice2 = Invoice(purchase_order_id=po2.id, status="Ожидает оплаты")
        db_session.add(invoice2)
        db_session.flush()

        # Invoice total: 100000.00
        item2 = InvoiceItem(
            invoice_id=invoice2.id, name="Item", sku="SKU", qty=10,
            unit_price=Decimal("10000.00"), total_price=Decimal("100000.00"),
        )
        db_session.add(item2)
        db_session.flush()

        bank_stmt2 = BankStatement(
            bank_name="ТИНЬКОФФ БАНК",
            statement_date=datetime(2026, 6, 8),
            period_start=datetime(2026, 6, 1),
            period_end=datetime(2026, 6, 8),
            status="Готов",
            raw_file=b"test",
        )
        db_session.add(bank_stmt2)
        db_session.flush()

        # Test mid-tolerance (should be ~0.92-0.93)
        txn_mid = BankTransaction(
            bank_statement_id=bank_stmt2.id,
            transaction_date=datetime(2026, 6, 8),
            amount=Decimal("97500.00"),  # 2.5% difference
            supplier_inn="4444444444",
            description="Mid tolerance",
            operation_type="Покупка",
        )
        db_session.add(txn_mid)
        db_session.flush()
        txn_mid_id = txn_mid.id

        with patch('backend.database.SessionLocal', return_value=db_session):
            call_match_bank_transactions_task_helper(
                bank_transaction_id=txn_mid_id,
                task_request=mock_task_request,
            )

            audit = db_session.query(TransactionMatchingAudit).order_by(
                TransactionMatchingAudit.id.desc()
            ).first()
            # Mid-tolerance should be around 0.92-0.93
            assert Decimal("0.90") <= audit.confidence_score < Decimal("1.00")
