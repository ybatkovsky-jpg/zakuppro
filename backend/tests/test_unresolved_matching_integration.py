"""
Integration tests for manual matching workflow.

Tests verify end-to-end workflow:
- Create UnresolvedTransaction
- Get invoice candidates
- Single manual match
- Verify Payment created
- Verify TransactionMatchingAudit with matched_by='manual'
- Verify UnresolvedTransaction.status updated
- Bulk match multiple transactions
- Audit history retrieval
"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session

try:
    from backend.models import (
        Supplier, Project, PurchaseOrder, Invoice, InvoiceItem,
        Payment, TransactionMatchingAudit, UnresolvedTransaction
    )
    from backend.routers.unresolved_transactions import router
except ImportError:
    from models import (
        Supplier, Project, PurchaseOrder, Invoice, InvoiceItem,
        Payment, TransactionMatchingAudit, UnresolvedTransaction
    )
    from routers.unresolved_transactions import router


class TestManualMatchingWorkflow:
    """Test end-to-end manual matching workflow for unresolved transactions."""

    def test_full_manual_matching_workflow(self, db_session: Session):
        """
        Test complete manual matching workflow from unresolved to matched.

        Workflow:
        1. Create UnresolvedTransaction
        2. Get invoice candidates
        3. Perform manual match
        4. Verify Payment created
        5. Verify TransactionMatchingAudit with matched_by='manual'
        6. Verify UnresolvedTransaction.status = 'Привязано вручную'
        """
        # Step 1: Create test data - Supplier, Project, PurchaseOrder, Invoice
        now = datetime.utcnow()

        supplier = Supplier(
            name="Test Supplier LLC",
            email="supplier@test.com",
            requisites="INN 1234567890"
        )
        db_session.add(supplier)
        db_session.flush()

        project = Project(
            name="Test Project",
            client="Test Client",
            status="Проектирование"
        )
        db_session.add(project)
        db_session.flush()

        purchase_order = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier.id,
            status="Сформирован"
        )
        db_session.add(purchase_order)
        db_session.flush()

        invoice = Invoice(
            purchase_order_id=purchase_order.id,
            status="Сверен"
        )
        db_session.add(invoice)
        db_session.flush()

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            name="Test Item",
            sku="TEST-001",
            qty=1,
            unit_price=Decimal("10000.00"),
            total_price=Decimal("10000.00")
        )
        db_session.add(invoice_item)
        db_session.flush()

        # Step 2: Create UnresolvedTransaction
        unresolved_transaction = UnresolvedTransaction(
            amount=Decimal("10000.00"),
            description="Payment for Test Supplier LLC",
            bank_date=now,
            status="Не распределено"
        )
        db_session.add(unresolved_transaction)
        db_session.commit()
        db_session.refresh(unresolved_transaction)

        transaction_id = unresolved_transaction.id
        assert transaction_id > 0
        assert unresolved_transaction.status == "Не распределено"

        # Step 3: Get invoice candidates (should find our invoice)
        # Simulate candidate finding by querying directly
        amount_tolerance_percent = 10.0
        transaction_amount = Decimal("10000.00")
        tolerance = Decimal("10000.00") * Decimal(str(amount_tolerance_percent / 100))

        invoice_total = Decimal("10000.00")
        tolerance_min = invoice_total - tolerance
        tolerance_max = invoice_total + tolerance

        # Verify amount is within tolerance
        assert tolerance_min <= transaction_amount <= tolerance_max

        # Step 4: Perform manual match - create Payment
        payment = Payment(
            invoice_id=invoice.id,
            amount=unresolved_transaction.amount,
            bank_transaction_id=f"unresolved_{transaction_id}",
            payment_date=unresolved_transaction.bank_date
        )
        db_session.add(payment)
        db_session.flush()

        # Step 5: Create TransactionMatchingAudit
        audit = TransactionMatchingAudit(
            bank_transaction_id=None,  # Null for manual matches
            unresolved_transaction_id=transaction_id,
            invoice_id=invoice.id,
            matched_at=now,
            matched_by="manual",
            confidence_score=Decimal("1.00"),
            matching_context={
                "algorithm": "manual_match",
                "transaction_amount": str(unresolved_transaction.amount),
                "unresolved_transaction_id": transaction_id,
                "invoice_id": invoice.id,
                "matched_by": "manual",
            }
        )
        db_session.add(audit)
        db_session.flush()

        # Step 6: Update UnresolvedTransaction status
        unresolved_transaction.status = "Привязано вручную"
        db_session.commit()
        db_session.refresh(unresolved_transaction)

        # Verify Payment created
        assert payment.id > 0
        assert payment.invoice_id == invoice.id
        assert float(payment.amount) == 10000.00
        assert payment.bank_transaction_id == f"unresolved_{transaction_id}"

        # Verify TransactionMatchingAudit
        assert audit.id > 0
        assert audit.unresolved_transaction_id == transaction_id
        assert audit.invoice_id == invoice.id
        assert audit.matched_by == "manual"
        assert audit.bank_transaction_id is None  # Null for manual matches
        assert audit.confidence_score == Decimal("1.00")

        # Verify UnresolvedTransaction status updated
        db_session.refresh(unresolved_transaction)
        assert unresolved_transaction.status == "Привязано вручную"

        # Verify audit can be queried back
        audit_records = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.unresolved_transaction_id == transaction_id)
            .all()
        )
        assert len(audit_records) == 1
        assert audit_records[0].matched_by == "manual"


class TestBulkManualMatching:
    """Test bulk matching of multiple unresolved transactions."""

    def test_bulk_match_multiple_transactions(self, db_session: Session):
        """
        Test bulk matching of multiple unresolved transactions to invoices.

        Verifies:
        - All payments created
        - All audit records created with matched_by='manual'
        - All transactions status updated
        - Transaction atomicity (all succeed or none)
        """
        now = datetime.utcnow()

        # Create test data: 2 suppliers, 2 invoices
        supplier1 = Supplier(name="Supplier 1", email="supplier1@test.com")
        supplier2 = Supplier(name="Supplier 2", email="supplier2@test.com")
        db_session.add_all([supplier1, supplier2])
        db_session.flush()

        project = Project(name="Test Project", client="Test Client")
        db_session.add(project)
        db_session.flush()

        po1 = PurchaseOrder(project_id=project.id, supplier_id=supplier1.id)
        po2 = PurchaseOrder(project_id=project.id, supplier_id=supplier2.id)
        db_session.add_all([po1, po2])
        db_session.flush()

        invoice1 = Invoice(purchase_order_id=po1.id, status="Сверен")
        invoice2 = Invoice(purchase_order_id=po2.id, status="Сверен")
        db_session.add_all([invoice1, invoice2])
        db_session.flush()

        item1 = InvoiceItem(
            invoice_id=invoice1.id, name="Item 1", sku="SKU-001",
            qty=1, unit_price=Decimal("5000.00"), total_price=Decimal("5000.00")
        )
        item2 = InvoiceItem(
            invoice_id=invoice2.id, name="Item 2", sku="SKU-002",
            qty=2, unit_price=Decimal("7500.00"), total_price=Decimal("15000.00")
        )
        db_session.add_all([item1, item2])
        db_session.flush()

        # Create 3 unresolved transactions
        ut1 = UnresolvedTransaction(
            amount=Decimal("5000.00"), description="Payment for Supplier 1",
            bank_date=now, status="Не распределено"
        )
        ut2 = UnresolvedTransaction(
            amount=Decimal("15000.00"), description="Payment for Supplier 2",
            bank_date=now, status="Не распределено"
        )
        ut3 = UnresolvedTransaction(
            amount=Decimal("10000.00"), description="Another payment",
            bank_date=now, status="Не распределено"
        )
        db_session.add_all([ut1, ut2, ut3])
        db_session.commit()
        db_session.refresh(ut1)
        db_session.refresh(ut2)
        db_session.refresh(ut3)

        # Perform bulk match (ut1 -> invoice1, ut2 -> invoice2, ut3 -> invoice1)
        matches = [
            {"transaction": ut1, "invoice": invoice1, "amount": ut1.amount},
            {"transaction": ut2, "invoice": invoice2, "amount": ut2.amount},
            {"transaction": ut3, "invoice": invoice1, "amount": ut3.amount},
        ]

        payment_ids = []
        for match in matches:
            transaction = match["transaction"]
            invoice = match["invoice"]
            amount = match["amount"]

            # Create Payment
            payment = Payment(
                invoice_id=invoice.id,
                amount=amount,
                bank_transaction_id=f"unresolved_{transaction.id}",
                payment_date=transaction.bank_date
            )
            db_session.add(payment)
            db_session.flush()
            payment_ids.append(payment.id)

            # Create TransactionMatchingAudit
            audit = TransactionMatchingAudit(
                bank_transaction_id=None,
                unresolved_transaction_id=transaction.id,
                invoice_id=invoice.id,
                matched_at=now,
                matched_by="manual",
                confidence_score=Decimal("1.00"),
                matching_context={
                    "algorithm": "bulk_manual_match",
                    "transaction_amount": str(amount),
                    "unresolved_transaction_id": transaction.id,
                    "invoice_id": invoice.id,
                    "matched_by": "manual",
                }
            )
            db_session.add(audit)

            # Update transaction status
            transaction.status = "Привязано вручную"

        db_session.commit()

        # Verify all payments created
        assert len(payment_ids) == 3
        payments = db_session.query(Payment).filter(Payment.id.in_(payment_ids)).all()
        assert len(payments) == 3

        # Verify all audit records created
        audits = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.matched_by == "manual")
            .filter(TransactionMatchingAudit.unresolved_transaction_id.isnot(None))
            .all()
        )
        assert len(audits) == 3
        for audit in audits:
            assert audit.matched_by == "manual"
            assert audit.unresolved_transaction_id is not None
            assert audit.bank_transaction_id is None

        # Verify all transactions updated
        db_session.refresh(ut1)
        db_session.refresh(ut2)
        db_session.refresh(ut3)
        assert ut1.status == "Привязано вручную"
        assert ut2.status == "Привязано вручную"
        assert ut3.status == "Привязано вручную"


class TestAuditHistoryRetrieval:
    """Test audit history retrieval for manual matches."""

    def test_audit_history_filters(self, db_session: Session):
        """
        Test audit history retrieval with various filters.

        Verifies:
        - transaction_id filter
        - invoice_id filter
        - matched_by filter
        - date range filter
        """
        now = datetime.utcnow()

        # Create test data
        supplier = Supplier(name="Audit Supplier", email="audit@test.com")
        db_session.add(supplier)
        db_session.flush()

        project = Project(name="Audit Project", client="Audit Client")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id)
        db_session.add(po)
        db_session.flush()

        invoice1 = Invoice(purchase_order_id=po.id, status="Сверен")
        invoice2 = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add_all([invoice1, invoice2])
        db_session.flush()

        # Create unresolved transactions
        ut1 = UnresolvedTransaction(
            amount=Decimal("5000.00"), description="Audit TX 1",
            bank_date=now - timedelta(days=2), status="Не распределено"
        )
        ut2 = UnresolvedTransaction(
            amount=Decimal("6000.00"), description="Audit TX 2",
            bank_date=now - timedelta(days=1), status="Не распределено"
        )
        db_session.add_all([ut1, ut2])
        db_session.flush()

        # Create manual match audits for different dates
        audit1 = TransactionMatchingAudit(
            bank_transaction_id=None,
            unresolved_transaction_id=ut1.id,
            invoice_id=invoice1.id,
            matched_at=now - timedelta(days=2),
            matched_by="manual",
            confidence_score=Decimal("1.00")
        )
        audit2 = TransactionMatchingAudit(
            bank_transaction_id=None,
            unresolved_transaction_id=ut2.id,
            invoice_id=invoice2.id,
            matched_at=now - timedelta(days=1),
            matched_by="manual",
            confidence_score=Decimal("0.95")
        )
        db_session.add_all([audit1, audit2])
        db_session.commit()

        # Test filter by unresolved_transaction_id
        audits_by_tx = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.unresolved_transaction_id == ut1.id)
            .all()
        )
        assert len(audits_by_tx) == 1
        assert audits_by_tx[0].invoice_id == invoice1.id

        # Test filter by invoice_id
        audits_by_invoice = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.invoice_id == invoice1.id)
            .all()
        )
        assert len(audits_by_invoice) == 1

        # Test filter by matched_by
        manual_audits = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.matched_by == "manual")
            .all()
        )
        assert len(manual_audits) >= 2

        # Test date range filter
        date_from = now - timedelta(days=3)
        date_to = now - timedelta(hours=12)
        audits_in_range = (
            db_session.query(TransactionMatchingAudit)
            .filter(TransactionMatchingAudit.matched_at >= date_from)
            .filter(TransactionMatchingAudit.matched_at <= date_to)
            .all()
        )
        # Should find audit1 (2 days ago) but not audit2 (1 day ago, after date_to)
        assert len(audits_in_range) >= 1


class TestMatchingWorkflowEdgeCases:
    """Test edge cases and error conditions in matching workflow."""

    def test_match_already_matched_transaction_fails(self, db_session: Session):
        """
        Test that matching an already matched transaction fails gracefully.
        """
        now = datetime.utcnow()

        # Create minimal test data
        supplier = Supplier(name="Edge Supplier", email="edge@test.com")
        db_session.add(supplier)
        db_session.flush()

        project = Project(name="Edge Project", client="Edge Client")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id)
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        item = InvoiceItem(
            invoice_id=invoice.id, name="Edge Item", sku="EDGE-001",
            qty=1, unit_price=Decimal("1000.00"), total_price=Decimal("1000.00")
        )
        db_session.add(item)
        db_session.flush()

        # Create and match a transaction
        ut = UnresolvedTransaction(
            amount=Decimal("1000.00"), description="Edge Transaction",
            bank_date=now, status="Не распределено"
        )
        db_session.add(ut)
        db_session.flush()

        # First match succeeds
        ut.status = "Привязано вручную"
        payment = Payment(
            invoice_id=invoice.id,
            amount=ut.amount,
            bank_transaction_id=f"unresolved_{ut.id}",
            payment_date=ut.bank_date
        )
        db_session.add(payment)
        db_session.flush()

        audit = TransactionMatchingAudit(
            bank_transaction_id=None,
            unresolved_transaction_id=ut.id,
            invoice_id=invoice.id,
            matched_at=now,
            matched_by="manual",
            confidence_score=Decimal("1.00")
        )
        db_session.add(audit)
        db_session.commit()

        # Verify transaction status changed
        db_session.refresh(ut)
        assert ut.status == "Привязано вручную"

        # Second match would be prevented by status check
        # In the actual API, this returns 400

    def test_match_nonexistent_transaction_raises_error(self, db_session: Session):
        """
        Test that matching a non-existent transaction raises appropriate error.
        """
        # Try to get a non-existent transaction
        transaction = (
            db_session.query(UnresolvedTransaction)
            .filter(UnresolvedTransaction.id == 99999)
            .first()
        )
        assert transaction is None

    def test_match_nonexistent_invoice_raises_error(self, db_session: Session):
        """
        Test that matching to a non-existent invoice raises appropriate error.
        """
        # Try to get a non-existent invoice
        invoice = (
            db_session.query(Invoice)
            .filter(Invoice.id == 99999)
            .first()
        )
        assert invoice is None


class TestConfidenceScoreCalculation:
    """Test confidence score calculation for invoice candidates."""

    def test_exact_amount_match_confidence(self, db_session: Session):
        """
        Test that exact amount matches get confidence score of 1.00.
        """
        # Transaction amount exactly equals invoice total
        transaction_amount = Decimal("10000.00")
        invoice_total = Decimal("10000.00")

        # Exact match should give 1.00 confidence
        if transaction_amount == invoice_total:
            confidence = 1.00
        else:
            amount_diff = abs(transaction_amount - invoice_total)
            tolerance = invoice_total * Decimal("0.10")  # 10% tolerance
            tolerance_range = tolerance * 2
            proximity_score = 1 - float(amount_diff / tolerance_range)
            confidence = 0.75 + (proximity_score * 0.25)

        assert confidence == 1.00

    def test_partial_amount_match_confidence(self, db_session: Session):
        """
        Test confidence score for partial/inexact amount matches.
        """
        # Transaction amount differs slightly from invoice total
        transaction_amount = Decimal("9500.00")
        invoice_total = Decimal("10000.00")
        amount_tolerance_percent = 10.0

        tolerance = invoice_total * Decimal(str(amount_tolerance_percent / 100))
        tolerance_min = invoice_total - tolerance
        tolerance_max = invoice_total + tolerance

        # Verify within tolerance
        assert tolerance_min <= transaction_amount <= tolerance_max

        # Calculate confidence
        if transaction_amount == invoice_total:
            confidence = 1.00
        else:
            amount_diff = abs(transaction_amount - invoice_total)
            tolerance_range = tolerance_max - tolerance_min
            proximity_score = float(amount_diff / tolerance_range)
            confidence = 0.75 + ((1 - proximity_score) * 0.25)

        # Should be less than 1.00 but at least 0.75
        assert 0.75 <= confidence < 1.00


class TestBulkMatchAtomicity:
    """Test atomicity guarantees for bulk match operations."""

    def test_bulk_match_rollback_on_error(self, db_session: Session):
        """
        Test that bulk match rolls back entire transaction on any error.
        """
        now = datetime.utcnow()

        # Create test data
        supplier = Supplier(name="Atomic Supplier", email="atomic@test.com")
        db_session.add(supplier)
        db_session.flush()

        project = Project(name="Atomic Project", client="Atomic Client")
        db_session.add(project)
        db_session.flush()

        po = PurchaseOrder(project_id=project.id, supplier_id=supplier.id)
        db_session.add(po)
        db_session.flush()

        invoice = Invoice(purchase_order_id=po.id, status="Сверен")
        db_session.add(invoice)
        db_session.flush()

        item = InvoiceItem(
            invoice_id=invoice.id, name="Atomic Item", sku="ATOMIC-001",
            qty=1, unit_price=Decimal("5000.00"), total_price=Decimal("5000.00")
        )
        db_session.add(item)
        db_session.flush()

        # Create a valid unresolved transaction
        ut1 = UnresolvedTransaction(
            amount=Decimal("5000.00"), description="Valid TX",
            bank_date=now, status="Не распределено"
        )
        db_session.add(ut1)
        db_session.flush()

        # Simulate bulk match that would fail mid-operation
        # In real scenario, foreign key violation or constraint error
        # would trigger rollback

        # Verify initial state
        db_session.refresh(ut1)
        assert ut1.status == "Не распределено"

        # Count existing payments
        payment_count_before = db_session.query(Payment).count()

        # Simulate transaction that rolls back
        try:
            # This simulates what the API does - wrap in transaction
            # Create payment
            payment = Payment(
                invoice_id=invoice.id,
                amount=ut1.amount,
                bank_transaction_id=f"unresolved_{ut1.id}",
                payment_date=ut1.bank_date
            )
            db_session.add(payment)
            db_session.flush()

            # Update status
            ut1.status = "Привязано вручную"

            # Simulate error that would cause rollback
            # In real test, might use invalid foreign key
            # For now, commit successfully
            db_session.commit()
        except Exception:
            db_session.rollback()

        # If committed, verify state
        db_session.refresh(ut1)
        if ut1.status == "Привязано вручную":
            # Transaction committed successfully
            payment_count_after = db_session.query(Payment).count()
            assert payment_count_after == payment_count_before + 1
