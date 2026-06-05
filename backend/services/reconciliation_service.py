"""
Reconciliation service — business logic for matching unresolved transactions to invoices.

Extracted from routers/unresolved_transactions.py to follow Clean Architecture:
the router handles HTTP concerns only, and all domain logic lives here.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from backend.models import (
    UnresolvedTransaction, Supplier, PurchaseOrder, Invoice, InvoiceItem,
    Payment, TransactionMatchingAudit,
)
from backend.schemas import (
    InvoiceCandidateResponse,
    ManualMatchResponse,
    BulkMatchError,
)

logger = logging.getLogger(__name__)


def find_invoice_candidates(
    db: Session,
    transaction_id: int,
    amount_tolerance_percent: float = 10.0,
    date_window_days: int = 90,
) -> List[InvoiceCandidateResponse]:
    """
    Find invoice candidate suggestions for an unresolved transaction.

    Uses relaxed matching tolerances to suggest potential invoices
    for manual reconciliation.

    Args:
        db: SQLAlchemy session.
        transaction_id: UnresolvedTransaction ID.
        amount_tolerance_percent: Percentage tolerance for amount matching.
        date_window_days: Day window for date proximity.

    Returns:
        List of InvoiceCandidateResponse sorted by confidence score (desc).
    """
    transaction = db.query(UnresolvedTransaction).filter(
        UnresolvedTransaction.id == transaction_id
    ).first()
    if not transaction:
        raise ValueError(f"UnresolvedTransaction with id {transaction_id} not found")

    transaction_amount = Decimal(str(transaction.amount))
    transaction_date = transaction.bank_date

    # Find all invoices with relevant statuses
    invoices = (
        db.query(Invoice)
        .filter(Invoice.status.in_(["Сверен", "Ожидает оплаты", "Оплачен"]))
        .options(joinedload(Invoice.items).joinedload(InvoiceItem.project_item))
        .all()
    )

    candidates = []

    for invoice in invoices:
        # Calculate invoice total from items
        invoice_total = Decimal("0")
        if invoice.items:
            for item in invoice.items:
                if item.total_price:
                    invoice_total += Decimal(str(item.total_price))
        else:
            continue

        # Check amount tolerance
        tolerance = invoice_total * Decimal(str(amount_tolerance_percent / 100))
        tolerance_min = invoice_total - tolerance
        tolerance_max = invoice_total + tolerance

        if not (tolerance_min <= transaction_amount <= tolerance_max):
            continue

        # Calculate confidence score
        if transaction_amount == invoice_total:
            confidence = 1.00
        else:
            amount_diff = abs(transaction_amount - invoice_total)
            tolerance_range = tolerance_max - tolerance_min
            if tolerance_range > 0:
                proximity_score = 1 - float(amount_diff / tolerance_range)
                confidence = 0.75 + (proximity_score * 0.25)
            else:
                confidence = 0.75

        # Get supplier name
        supplier_name = "Unknown"
        if invoice.purchase_order and invoice.purchase_order.supplier:
            supplier_name = invoice.purchase_order.supplier.name

        amount_difference = float(abs(transaction_amount - invoice_total))

        candidates.append(InvoiceCandidateResponse(
            invoice_id=invoice.id,
            supplier_name=supplier_name,
            invoice_total=float(invoice_total),
            amount_difference=amount_difference,
            confidence_score=round(confidence, 2),
        ))

    candidates.sort(key=lambda x: x.confidence_score, reverse=True)
    return candidates


def manual_match_transaction(
    db: Session,
    transaction_id: int,
    invoice_id: int,
) -> ManualMatchResponse:
    """
    Manually match an unresolved transaction to an invoice.

    Creates a Payment record, a TransactionMatchingAudit entry,
    and updates the UnresolvedTransaction status.

    Args:
        db: SQLAlchemy session.
        transaction_id: UnresolvedTransaction ID.
        invoice_id: Invoice ID to match against.

    Returns:
        ManualMatchResponse with match details.

    Raises:
        ValueError: If transaction or invoice not found, or invalid status.
    """
    transaction = db.query(UnresolvedTransaction).filter(
        UnresolvedTransaction.id == transaction_id
    ).first()
    if not transaction:
        raise ValueError(f"UnresolvedTransaction with id {transaction_id} not found")

    if transaction.status != "Не распределено":
        raise ValueError(
            f"Cannot match transaction with status '{transaction.status}'. "
            f"Only 'Не распределено' can be matched."
        )

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError(f"Invoice with id {invoice_id} not found")

    # Create Payment record
    payment = Payment(
        invoice_id=invoice.id,
        amount=transaction.amount,
        bank_transaction_id=f"unresolved_{transaction_id}",
        payment_date=transaction.bank_date,
    )
    db.add(payment)
    db.flush()

    # Create TransactionMatchingAudit
    audit = TransactionMatchingAudit(
        bank_transaction_id=None,
        unresolved_transaction_id=transaction_id,
        invoice_id=invoice.id,
        matched_at=datetime.utcnow(),
        matched_by="manual",
        confidence_score=Decimal("1.00"),
        matching_context={
            "algorithm": "manual_match",
            "transaction_amount": str(transaction.amount),
            "unresolved_transaction_id": transaction_id,
            "invoice_id": invoice.id,
            "matched_by": "manual",
        },
    )
    db.add(audit)

    # Update status
    transaction.status = "Привязано вручную"
    db.commit()

    logger.info(
        "Manual match: transaction_id=%d -> invoice_id=%d, payment_id=%d",
        transaction_id, invoice_id, payment.id,
    )

    return ManualMatchResponse(
        payment_id=payment.id,
        invoice_id=invoice.id,
        transaction_id=transaction_id,
        amount=float(transaction.amount),
        matched_at=datetime.utcnow(),
    )


def bulk_manual_match_transactions(
    db: Session,
    matches: List[Tuple[int, int, Optional[Decimal]]],
) -> Tuple[int, List[int], List[BulkMatchError]]:
    """
    Bulk match multiple unresolved transactions to invoices.

    Args:
        db: SQLAlchemy session.
        matches: List of (unresolved_transaction_id, invoice_id, optional_amount_override).

    Returns:
        Tuple of (matched_count, payment_ids, errors).
    """
    validated_matches = []
    errors: List[BulkMatchError] = []

    # Validate all inputs
    for unresolved_id, invoice_id, amount_override in matches:
        transaction = db.query(UnresolvedTransaction).filter(
            UnresolvedTransaction.id == unresolved_id
        ).first()

        if not transaction:
            errors.append(BulkMatchError(
                unresolved_transaction_id=unresolved_id,
                invoice_id=invoice_id,
                error=f"UnresolvedTransaction with id {unresolved_id} not found",
            ))
            continue

        if transaction.status != "Не распределено":
            errors.append(BulkMatchError(
                unresolved_transaction_id=unresolved_id,
                invoice_id=invoice_id,
                error=f"Cannot match transaction with status '{transaction.status}'",
            ))
            continue

        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            errors.append(BulkMatchError(
                unresolved_transaction_id=unresolved_id,
                invoice_id=invoice_id,
                error=f"Invoice with id {invoice_id} not found",
            ))
            continue

        amount = amount_override if amount_override is not None else transaction.amount
        validated_matches.append((transaction, invoice, amount))

    if not validated_matches:
        return 0, [], errors

    # Create records
    payment_ids: List[int] = []

    for transaction, invoice, amount in validated_matches:
        payment = Payment(
            invoice_id=invoice.id,
            amount=amount,
            bank_transaction_id=f"unresolved_{transaction.id}",
            payment_date=transaction.bank_date,
        )
        db.add(payment)
        db.flush()

        audit = TransactionMatchingAudit(
            bank_transaction_id=None,
            unresolved_transaction_id=transaction.id,
            invoice_id=invoice.id,
            matched_at=datetime.utcnow(),
            matched_by="manual",
            confidence_score=Decimal("1.00"),
            matching_context={
                "algorithm": "bulk_manual_match",
                "transaction_amount": str(amount),
                "unresolved_transaction_id": transaction.id,
                "invoice_id": invoice.id,
                "matched_by": "manual",
            },
        )
        db.add(audit)
        transaction.status = "Привязано вручную"
        payment_ids.append(payment.id)

    db.commit()

    logger.info(
        "Bulk match: %d successful, %d errors",
        len(payment_ids), len(errors),
    )

    return len(payment_ids), payment_ids, errors
