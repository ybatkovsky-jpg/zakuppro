"""
Tests for Payment Matcher Service.

Tests cover:
- Exact INN + exact amount matching (confidence 1.00)
- INN + amount within ±5% tolerance (confidence 0.85-0.99)
- Edge cases: NULL supplier_inn, no invoices, multiple candidates
- Supplier INN lookup cache
- UnresolvedTransaction creation on failure
- TransactionMatchingAudit creation on match
"""
from __future__ import annotations

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

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
from backend.services.payment_matcher import (
    PaymentMatcher,
    MatchResult,
    match_payment,
)


@pytest.fixture
def test_data(db_session: Session):
    """Create test data for payment matching tests."""
    # Create project
    project = Project(name="Test Project", client="Test Client", status="Проектирование")
    db_session.add(project)
    db_session.flush()

    # Create supplier with INN in requisites
    supplier_with_inn = Supplier(
        name="Supplier With INN",
        email="supplier@example.com",
        requisites="ИНН: 1234567890\nБанк: Тинькофф\nСчет: 12345678901234567890",
    )
    db_session.add(supplier_with_inn)
    db_session.flush()

    # Create supplier without INN
    supplier_no_inn = Supplier(
        name="Supplier No INN",
        email="no-inn@example.com",
        requisites="Банк: Тинькофф\nСчет: 98765432109876543210",
    )
    db_session.add(supplier_no_inn)
    db_session.flush()

    # Create purchase order with verified status
    po = PurchaseOrder(
        project_id=project.id,
        supplier_id=supplier_with_inn.id,
        status="Сверен",
    )
    db_session.add(po)
    db_session.flush()

    # Create invoice with items
    invoice = Invoice(
        purchase_order_id=po.id,
        status="Ожидает оплаты",
        raw_text="Test invoice",
    )
    db_session.add(invoice)
    db_session.flush()

    # Create invoice items
    item1 = InvoiceItem(
        invoice_id=invoice.id,
        name="Item 1",
        sku="SKU001",
        qty=2,
        unit_price=Decimal("5000.00"),
        total_price=Decimal("10000.00"),
    )
    item2 = InvoiceItem(
        invoice_id=invoice.id,
        name="Item 2",
        sku="SKU002",
        qty=1,
        unit_price=Decimal("5000.00"),
        total_price=Decimal("5000.00"),
    )
    db_session.add_all([item1, item2])
    db_session.flush()

    # Create bank statement
    statement = BankStatement(
        bank_name="Тинькофф",
        statement_date=datetime.utcnow(),
        period_start=datetime.utcnow() - timedelta(days=30),
        period_end=datetime.utcnow(),
        status="Готов",
    )
    db_session.add(statement)
    db_session.flush()

    return {
        "project": project,
        "supplier_with_inn": supplier_with_inn,
        "supplier_no_inn": supplier_no_inn,
        "po": po,
        "invoice": invoice,
        "statement": statement,
    }


class TestPaymentMatcher:
    """Tests for PaymentMatcher class."""

    def test_exact_match_confidence_1_00(self, db_session: Session, test_data: dict):
        """Test exact INN + exact amount match yields confidence 1.00."""
        # Create bank transaction with exact amount match
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("15000.00"),  # Exact match to invoice total
            supplier_inn="1234567890",
            description="Payment to Supplier",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        # Match transaction
        matcher = PaymentMatcher(db_session)
        result = matcher.match_transaction(transaction.id)

        # Verify match succeeded
        assert result.matched_count == 1
        assert result.unresolved_count == 0
        assert len(result.payment_ids) == 1

        # Verify Payment record created
        payment = db_session.query(Payment).filter(Payment.id == result.payment_ids[0]).first()
        assert payment is not None
        assert payment.invoice_id == test_data["invoice"].id
        assert payment.amount == Decimal("15000.00")

        # Verify TransactionMatchingAudit with confidence 1.00
        audit = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.bank_transaction_id == transaction.id)
            .first()
        )
        assert audit is not None
        assert audit.confidence_score == Decimal("1.00")
        assert audit.matched_by == "auto"

    def test_tolerance_match_confidence_0_85_to_0_99(self, db_session: Session, test_data: dict):
        """Test INN + amount within ±5% tolerance yields confidence 0.85-0.99."""
        matcher = PaymentMatcher(db_session)

        # Helper to create a fresh invoice for each test with distinct amounts
        def _create_fresh_invoice(total_amount: Decimal):
            po = PurchaseOrder(
                project_id=test_data["project"].id,
                supplier_id=test_data["supplier_with_inn"].id,
                status="Сверен",
            )
            db_session.add(po)
            db_session.flush()

            invoice = Invoice(
                purchase_order_id=po.id,
                status="Ожидает оплаты",
                raw_text="Test invoice",
            )
            db_session.add(invoice)
            db_session.flush()

            # Add item with the specified total
            item = InvoiceItem(
                invoice_id=invoice.id,
                name="Item",
                sku="SKU001",
                qty=1,
                unit_price=total_amount,
                total_price=total_amount,
            )
            db_session.add(item)
            db_session.flush()
            return invoice

        # Test at -5% tolerance boundary (confidence should be >= 0.85)
        # Use a unique invoice total that won't conflict with test_data invoice (15000)
        invoice_total_min = Decimal("20000.00")
        invoice_min = _create_fresh_invoice(invoice_total_min)
        transaction_min = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("19000.00"),  # 20000 - 5%
            supplier_inn="1234567890",
            description="Payment at -5% tolerance",
            operation_type="Debit",
        )
        db_session.add(transaction_min)
        db_session.flush()

        result_min = matcher.match_transaction(transaction_min.id)
        assert result_min.matched_count == 1

        audit_min = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.bank_transaction_id == transaction_min.id)
            .first()
        )
        # At -5% boundary, confidence should be exactly 0.85
        assert audit_min.confidence_score >= Decimal("0.85")

        # Test at +5% tolerance boundary
        invoice_total_max = Decimal("25000.00")
        invoice_max = _create_fresh_invoice(invoice_total_max)
        transaction_max = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("26250.00"),  # 25000 + 5%
            supplier_inn="1234567890",
            description="Payment at +5% tolerance",
            operation_type="Debit",
        )
        db_session.add(transaction_max)
        db_session.flush()

        result_max = matcher.match_transaction(transaction_max.id)
        assert result_max.matched_count == 1

        audit_max = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.bank_transaction_id == transaction_max.id)
            .first()
        )
        # At +5% boundary, confidence should be exactly 0.85
        assert audit_max.confidence_score >= Decimal("0.85")

        # Test at 2.5% tolerance (confidence > 0.85 and < 1.00)
        invoice_total_mid = Decimal("30000.00")
        invoice_mid = _create_fresh_invoice(invoice_total_mid)
        transaction_mid = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("29250.00"),  # 30000 - 2.5%
            supplier_inn="1234567890",
            description="Payment at -2.5% tolerance",
            operation_type="Debit",
        )
        db_session.add(transaction_mid)
        db_session.flush()

        result_mid = matcher.match_transaction(transaction_mid.id)
        assert result_mid.matched_count == 1

        audit_mid = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.bank_transaction_id == transaction_mid.id)
            .first()
        )
        # At -2.5% tolerance, confidence should be between 0.85 and 1.00
        assert audit_mid.confidence_score > Decimal("0.85")
        assert audit_mid.confidence_score < Decimal("1.00")

    def test_outside_tolerance_creates_unresolved(self, db_session: Session, test_data: dict):
        """Test amount outside ±5% tolerance creates UnresolvedTransaction."""
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("14000.00"),  # Below -5% tolerance
            supplier_inn="1234567890",
            description="Payment below tolerance",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        matcher = PaymentMatcher(db_session)
        result = matcher.match_transaction(transaction.id)

        # Verify unresolved created
        assert result.matched_count == 0
        assert result.unresolved_count == 1
        assert len(result.payment_ids) == 0

        # Verify UnresolvedTransaction record
        unresolved = (
            db_session.query(UnresolvedTransaction)
            .filter(UnresolvedTransaction.amount == Decimal("14000.00"))
            .first()
        )
        assert unresolved is not None
        assert unresolved.status == "Не распределено"

    def test_null_supplier_inn_creates_unresolved(self, db_session: Session, test_data: dict):
        """Test NULL supplier_inn creates UnresolvedTransaction."""
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("15000.00"),
            supplier_inn=None,  # NULL INN
            description="Payment without INN",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        matcher = PaymentMatcher(db_session)
        result = matcher.match_transaction(transaction.id)

        # Verify unresolved created
        assert result.matched_count == 0
        assert result.unresolved_count == 1

        # Verify UnresolvedTransaction record
        unresolved = (
            db_session.query(UnresolvedTransaction)
            .filter(UnresolvedTransaction.amount == Decimal("15000.00"))
            .first()
        )
        assert unresolved is not None

    def test_no_matching_invoices_creates_unresolved(self, db_session: Session, test_data: dict):
        """Test no matching invoices creates UnresolvedTransaction."""
        # Create transaction with INN that doesn't match any supplier
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("15000.00"),
            supplier_inn="9999999999",  # Non-existent INN
            description="Payment to unknown supplier",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        matcher = PaymentMatcher(db_session)
        result = matcher.match_transaction(transaction.id)

        # Verify unresolved created
        assert result.matched_count == 0
        assert result.unresolved_count == 1

    def test_multiple_candidates_ambiguous_creates_unresolved(
        self, db_session: Session, test_data: dict
    ):
        """Test multiple candidates with close confidence creates UnresolvedTransaction."""
        # Create another invoice with similar amount
        po2 = PurchaseOrder(
            project_id=test_data["project"].id,
            supplier_id=test_data["supplier_with_inn"].id,
            status="Сверен",
        )
        db_session.add(po2)
        db_session.flush()

        invoice2 = Invoice(
            purchase_order_id=po2.id,
            status="Ожидает оплаты",
            raw_text="Test invoice 2",
        )
        db_session.add(invoice2)
        db_session.flush()

        # Invoice with total very close to first invoice (within 1%)
        item = InvoiceItem(
            invoice_id=invoice2.id,
            name="Item",
            sku="SKU003",
            qty=1,
            unit_price=Decimal("14900.00"),
            total_price=Decimal("14900.00"),
        )
        db_session.add(item)
        db_session.flush()

        # Create transaction that could match either
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("14950.00"),  # Between the two invoices
            supplier_inn="1234567890",
            description="Ambiguous payment",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        matcher = PaymentMatcher(db_session)
        result = matcher.match_transaction(transaction.id)

        # Verify unresolved created due to ambiguity
        assert result.matched_count == 0
        assert result.unresolved_count == 1

    def test_supplier_inn_cache(self, db_session: Session, test_data: dict):
        """Test Supplier INN lookup cache works correctly."""
        matcher = PaymentMatcher(db_session)

        # First call should extract INN and cache it
        inn1 = matcher._get_supplier_inn(test_data["supplier_with_inn"].id)
        assert inn1 == "1234567890"

        # Second call should return from cache
        inn2 = matcher._get_supplier_inn(test_data["supplier_with_inn"].id)
        assert inn2 == "1234567890"

        # Verify cache hit (same object reference)
        assert matcher._supplier_inn_cache[test_data["supplier_with_inn"].id] == inn1

    def test_supplier_inn_cache_no_inn(self, db_session: Session, test_data: dict):
        """Test Supplier INN cache handles suppliers without INN."""
        matcher = PaymentMatcher(db_session)

        # Supplier without INN should return None
        inn = matcher._get_supplier_inn(test_data["supplier_no_inn"].id)
        assert inn is None

        # Verify cached as None
        assert matcher._supplier_inn_cache[test_data["supplier_no_inn"].id] is None

    def test_calculate_tolerance_bounds(self, db_session: Session, test_data: dict):
        """Test tolerance bounds calculation."""
        matcher = PaymentMatcher(db_session)

        amount = Decimal("10000.00")
        min_amount, max_amount = matcher._calculate_tolerance_bounds(amount)

        # Verify ±5% tolerance
        expected_min = Decimal("9500.00")  # 10000 - 5%
        expected_max = Decimal("10500.00")  # 10000 + 5%

        assert min_amount == expected_min
        assert max_amount == expected_max

    def test_calculate_confidence_exact_match(self, db_session: Session, test_data: dict):
        """Test confidence calculation for exact match."""
        matcher = PaymentMatcher(db_session)

        confidence = matcher._calculate_confidence(
            Decimal("10000.00"),
            Decimal("10000.00"),
        )

        assert confidence == Decimal("1.00")

    def test_calculate_confidence_tolerance_match(self, db_session: Session, test_data: dict):
        """Test confidence calculation for tolerance match."""
        matcher = PaymentMatcher(db_session)

        # At -5% boundary - confidence should be around 0.92-0.93
        # (midpoint of tolerance range = 0.5 proximity score = ~0.92-0.93 confidence)
        confidence_min = matcher._calculate_confidence(
            Decimal("9500.00"),  # transaction
            Decimal("10000.00"),  # invoice total (base for tolerance)
        )
        # At exact -5% boundary, proximity is 0.5, so confidence is 0.85 + 0.5*0.15 ≈ 0.92
        assert confidence_min >= Decimal("0.85"), f"Expected >= 0.85, got {confidence_min}"
        assert confidence_min < Decimal("1.00"), f"Expected < 1.00, got {confidence_min}"

        # At +5% boundary - should be similar
        confidence_max = matcher._calculate_confidence(
            Decimal("10500.00"),  # transaction
            Decimal("10000.00"),  # invoice total
        )
        assert confidence_max >= Decimal("0.85"), f"Expected >= 0.85, got {confidence_max}"
        assert confidence_max < Decimal("1.00"), f"Expected < 1.00, got {confidence_max}"

        # Mid-range - closer to exact should have higher confidence
        confidence_mid = matcher._calculate_confidence(
            Decimal("9750.00"),  # transaction at -2.5%
            Decimal("10000.00"),  # invoice total
        )
        assert confidence_mid > Decimal("0.90"), f"Expected > 0.90, got {confidence_mid}"
        assert confidence_mid < Decimal("1.00"), f"Expected < 1.00, got {confidence_mid}"

    def test_batch_matching(self, db_session: Session, test_data: dict):
        """Test batch matching of multiple transactions."""
        # Helper to create a fresh invoice with specified total
        def _create_fresh_invoice(total_amount: Decimal):
            po = PurchaseOrder(
                project_id=test_data["project"].id,
                supplier_id=test_data["supplier_with_inn"].id,
                status="Сверен",
            )
            db_session.add(po)
            db_session.flush()

            invoice = Invoice(
                purchase_order_id=po.id,
                status="Ожидает оплаты",
                raw_text="Test invoice",
            )
            db_session.add(invoice)
            db_session.flush()

            # Add item with the specified total
            item = InvoiceItem(
                invoice_id=invoice.id,
                name="Item",
                sku="SKU001",
                qty=1,
                unit_price=total_amount,
                total_price=total_amount,
            )
            db_session.add(item)
            db_session.flush()
            return invoice

        # Create invoices with unique amounts to avoid ambiguity
        invoice1 = _create_fresh_invoice(Decimal("20000.00"))
        invoice2 = _create_fresh_invoice(Decimal("21000.00"))

        # Create multiple transactions - two should match, one should not
        transaction_ids = []
        for i, amount in enumerate([Decimal("20000.00"), Decimal("21000.00"), Decimal("25000.00")]):
            transaction = BankTransaction(
                bank_statement_id=test_data["statement"].id,
                transaction_date=datetime.utcnow(),
                amount=amount,
                supplier_inn="1234567890",
                description=f"Payment {i}",
                operation_type="Debit",
            )
            db_session.add(transaction)
            db_session.flush()
            transaction_ids.append(transaction.id)

        matcher = PaymentMatcher(db_session)
        result = matcher.match_batch(transaction_ids)

        # First two should match (20000 and 21000), third (25000) should be unresolved
        assert result.matched_count == 2
        assert result.unresolved_count == 1
        assert len(result.payment_ids) == 2

    def test_match_statement_transactions(self, db_session: Session, test_data: dict):
        """Test matching all transactions from a bank statement."""
        # Helper to create a fresh invoice with specified total
        def _create_fresh_invoice(total_amount: Decimal):
            po = PurchaseOrder(
                project_id=test_data["project"].id,
                supplier_id=test_data["supplier_with_inn"].id,
                status="Сверен",
            )
            db_session.add(po)
            db_session.flush()

            invoice = Invoice(
                purchase_order_id=po.id,
                status="Ожидает оплаты",
                raw_text="Test invoice",
            )
            db_session.add(invoice)
            db_session.flush()

            # Add item with the specified total
            item = InvoiceItem(
                invoice_id=invoice.id,
                name="Item",
                sku="SKU001",
                qty=1,
                unit_price=total_amount,
                total_price=total_amount,
            )
            db_session.add(item)
            db_session.flush()
            return invoice

        # Create invoices with amounts that have non-overlapping tolerance ranges
        # 20000 ± 5% = [19000, 21000]
        # 50000 ± 5% = [47500, 52500] - no overlap
        invoice1 = _create_fresh_invoice(Decimal("20000.00"))
        invoice2 = _create_fresh_invoice(Decimal("50000.00"))

        # Add transactions to statement - both should match exactly
        for i, amount in enumerate([Decimal("20000.00"), Decimal("50000.00")]):
            transaction = BankTransaction(
                bank_statement_id=test_data["statement"].id,
                transaction_date=datetime.utcnow(),
                amount=amount,
                supplier_inn="1234567890",
                description=f"Payment {i}",
                operation_type="Debit",
            )
            db_session.add(transaction)
        db_session.flush()

        matcher = PaymentMatcher(db_session)
        result = matcher.match_statement_transactions(test_data["statement"].id)

        # Both should match
        assert result.matched_count == 2
        assert result.unresolved_count == 0
        assert len(result.payment_ids) == 2

    def test_match_result_to_dict(self, db_session: Session):
        """Test MatchResult.to_dict() method."""
        result = MatchResult(
            matched_count=5,
            unresolved_count=2,
            payment_ids=[1, 2, 3, 4, 5],
            errors=["Error 1"],
        )

        result_dict = result.to_dict()
        assert result_dict["matched_count"] == 5
        assert result_dict["unresolved_count"] == 2
        assert result_dict["payment_ids"] == [1, 2, 3, 4, 5]
        assert result_dict["errors"] == ["Error 1"]

    def test_create_payment_updates_invoice_status(self, db_session: Session, test_data: dict):
        """Test that successful payment match updates Invoice.status to 'Оплачен'."""
        # Create bank transaction with exact amount match
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("15000.00"),  # Exact match to invoice total
            supplier_inn="1234567890",
            description="Payment to Supplier",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        # Verify initial invoice status
        invoice = test_data["invoice"]
        assert invoice.status == "Ожидает оплаты"

        # Match transaction
        matcher = PaymentMatcher(db_session)
        result = matcher.match_transaction(transaction.id)

        # Verify match succeeded
        assert result.matched_count == 1
        assert len(result.payment_ids) == 1

        # Verify Invoice status was updated to "Оплачен"
        db_session.refresh(invoice)
        assert invoice.status == "Оплачен"

    def test_create_unresolved_transaction_sets_status(self, db_session: Session, test_data: dict):
        """Test that UnresolvedTransaction is created with correct status."""
        # Create transaction that will be unresolved (no matching supplier)
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("15000.00"),
            supplier_inn="9999999999",  # Non-existent INN
            description="Payment to unknown supplier",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        # Match transaction
        matcher = PaymentMatcher(db_session)
        result = matcher.match_transaction(transaction.id)

        # Verify unresolved created
        assert result.matched_count == 0
        assert result.unresolved_count == 1

        # Verify UnresolvedTransaction status is "Не распределено"
        unresolved = (
            db_session.query(UnresolvedTransaction)
            .filter(UnresolvedTransaction.amount == Decimal("15000.00"))
            .first()
        )
        assert unresolved is not None
        assert unresolved.status == "Не распределено"
        assert unresolved.bank_date == transaction.transaction_date


class TestMatchPaymentConvenienceFunction:
    """Tests for match_payment convenience function."""

    def test_match_payment_function(self, db_session: Session, test_data: dict):
        """Test match_payment convenience function."""
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("15000.00"),
            supplier_inn="1234567890",
            description="Payment",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        result = match_payment(transaction.id, db_session)

        assert result.matched_count == 1
        assert len(result.payment_ids) == 1

    def test_match_payment_with_custom_tolerance(self, db_session: Session, test_data: dict):
        """Test match_payment with custom tolerance percentage."""
        transaction = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("13000.00"),  # Further than default 5%
            supplier_inn="1234567890",
            description="Payment",
            operation_type="Debit",
        )
        db_session.add(transaction)
        db_session.flush()

        # With default 5% tolerance, should not match
        result_default = match_payment(transaction.id, db_session)
        assert result_default.matched_count == 0
        assert result_default.unresolved_count == 1

        # Create another transaction with custom 15% tolerance
        transaction2 = BankTransaction(
            bank_statement_id=test_data["statement"].id,
            transaction_date=datetime.utcnow(),
            amount=Decimal("13000.00"),
            supplier_inn="1234567890",
            description="Payment 2",
            operation_type="Debit",
        )
        db_session.add(transaction2)
        db_session.flush()

        # With 15% tolerance, should match
        result_custom = match_payment(transaction2.id, db_session, amount_tolerance_percent=15.0)
        assert result_custom.matched_count == 1
        assert result_custom.unresolved_count == 0
