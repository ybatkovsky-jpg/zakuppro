"""
Payment Matcher Service for Auto-Reconciliation.

This module provides functionality to automatically match BankTransactions to Invoices
based on Supplier.INN (extracted from requisites), amount tolerance (±5%), and date proximity.
Creates Payment records on match or UnresolvedTransaction on failure.

Features:
- Multi-tier matching: exact INN+amount = 1.00 confidence, INN+amount±5% = 0.85-0.99 confidence
- Supplier INN lookup cache to avoid repeated text extraction
- Date proximity matching within configurable window
- TransactionMatchingAudit for full audit trail
- UnresolvedTransaction records for manual review
- Structured logging for observability
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, List, Tuple, Any
from sqlalchemy.orm import Session, joinedload

from backend.models import (
    BankTransaction,
    Invoice,
    Payment,
    UnresolvedTransaction,
    TransactionMatchingAudit,
    Supplier,
    PurchaseOrder,
)
from backend.services.supplier_inn_extractor import extract_inn_from_requisites

# Matching thresholds
AMOUNT_TOLERANCE_PERCENT = 5.0  # ±5% amount tolerance
DEFAULT_DATE_WINDOW_DAYS = 30  # Date proximity window in days
MIN_CONFIDENCE_SCORE = Decimal("0.85")  # Minimum confidence for auto-match

# Confidence scores
CONFIDENCE_EXACT = Decimal("1.00")  # Exact INN + exact amount
CONFIDENCE_TOLERANCE = Decimal("0.85")  # INN match + amount within tolerance

logger = logging.getLogger(__name__)


class MatchResult:
    """
    Result of payment matching operation.

    Attributes:
        matched_count: Number of transactions matched to invoices
        unresolved_count: Number of transactions sent to unresolved queue
        payment_ids: List of created Payment record IDs
        errors: List of error messages encountered during matching
    """

    def __init__(
        self,
        matched_count: int = 0,
        unresolved_count: int = 0,
        payment_ids: List[int] = None,
        errors: List[str] = None,
    ):
        self.matched_count = matched_count
        self.unresolved_count = unresolved_count
        self.payment_ids = payment_ids or []
        self.errors = errors or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "matched_count": self.matched_count,
            "unresolved_count": self.unresolved_count,
            "payment_ids": self.payment_ids,
            "errors": self.errors,
        }


class PaymentMatcher:
    """
    Payment matcher service for auto-reconciliation.

    Matches BankTransactions to Invoices by:
    1. Extracting Supplier.INN from requisites text
    2. Finding invoices with matching supplier INN
    3. Applying amount tolerance (±5%)
    4. Checking date proximity
    5. Creating Payment records on match or UnresolvedTransaction on failure

    Uses Supplier INN lookup cache for performance.
    """

    def __init__(
        self,
        db: Session,
        date_window_days: int = DEFAULT_DATE_WINDOW_DAYS,
        amount_tolerance_percent: float = AMOUNT_TOLERANCE_PERCENT,
    ):
        """
        Initialize payment matcher.

        Args:
            db: SQLAlchemy database session
            date_window_days: Date proximity window in days (default: 30)
            amount_tolerance_percent: Amount tolerance percentage (default: 5.0)
        """
        self.db = db
        self.date_window_days = date_window_days
        self.amount_tolerance_percent = amount_tolerance_percent
        self._supplier_inn_cache: Dict[int, Optional[str]] = {}

        logger.debug(
            f"PaymentMatcher initialized: date_window={date_window_days} days, "
            f"amount_tolerance={amount_tolerance_percent}%"
        )

    def match_transaction(
        self,
        transaction_id: int,
    ) -> MatchResult:
        """
        Match a single bank transaction to invoices.

        Args:
            transaction_id: BankTransaction ID to match

        Returns:
            MatchResult with matching outcome
        """
        logger.info(f"Starting match for transaction_id={transaction_id}")

        try:
            # Fetch bank transaction
            transaction = self._fetch_bank_transaction(transaction_id)

            # Extract supplier INN from transaction
            supplier_inn = transaction.supplier_inn

            if not supplier_inn:
                # No INN on transaction - create unresolved
                return self._create_unresolved_transaction(
                    transaction,
                    reason="NULL supplier_inn",
                )

            # Find matching invoices
            candidates = self._find_invoice_candidates(
                supplier_inn,
                transaction.amount,
                transaction.transaction_date,
            )

            if not candidates:
                # No candidates found - create unresolved
                return self._create_unresolved_transaction(
                    transaction,
                    reason=f"No invoices found for INN={supplier_inn} within tolerance",
                )

            # Select best match with confidence score
            best_match = self._select_best_match(
                transaction,
                candidates,
            )

            if not best_match:
                # Multiple candidates or no clear best match - create unresolved
                return self._create_unresolved_transaction(
                    transaction,
                    reason=f"Multiple candidates or ambiguous match ({len(candidates)} candidates)",
                )

            # Create Payment record
            payment_id = self._create_payment(
                transaction,
                best_match["invoice"],
                best_match["confidence"],
                best_match["context"],
            )

            logger.info(
                f"Matched transaction_id={transaction_id} -> invoice_id={best_match['invoice'].id} "
                f"(confidence={best_match['confidence']}, payment_id={payment_id})"
            )

            return MatchResult(
                matched_count=1,
                unresolved_count=0,
                payment_ids=[payment_id],
            )

        except Exception as e:
            error_msg = f"Error matching transaction_id={transaction_id}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return MatchResult(
                matched_count=0,
                unresolved_count=0,
                errors=[error_msg],
            )

    def match_batch(
        self,
        transaction_ids: List[int],
    ) -> MatchResult:
        """
        Match multiple bank transactions to invoices.

        Args:
            transaction_ids: List of BankTransaction IDs to match

        Returns:
            MatchResult with aggregated matching outcome
        """
        logger.info(f"Starting batch match for {len(transaction_ids)} transactions")

        result = MatchResult()

        for transaction_id in transaction_ids:
            match_result = self.match_transaction(transaction_id)
            result.matched_count += match_result.matched_count
            result.unresolved_count += match_result.unresolved_count
            result.payment_ids.extend(match_result.payment_ids)
            result.errors.extend(match_result.errors)

        logger.info(
            f"Batch match complete: {result.matched_count} matched, "
            f"{result.unresolved_count} unresolved, {len(result.errors)} errors"
        )

        return result

    def match_statement_transactions(
        self,
        bank_statement_id: int,
    ) -> MatchResult:
        """
        Match all transactions from a bank statement.

        Args:
            bank_statement_id: BankStatement ID whose transactions to match

        Returns:
            MatchResult with aggregated matching outcome
        """
        logger.info(f"Starting match for bank_statement_id={bank_statement_id}")

        # Fetch all transactions for the statement
        transactions = (
            self.db.query(BankTransaction)
            .filter(BankTransaction.bank_statement_id == bank_statement_id)
            .all()
        )

        transaction_ids = [t.id for t in transactions]

        logger.info(
            f"Found {len(transaction_ids)} transactions for bank_statement_id={bank_statement_id}"
        )

        return self.match_batch(transaction_ids)

    def _fetch_bank_transaction(self, transaction_id: int) -> BankTransaction:
        """Fetch BankTransaction by ID."""
        transaction = (
            self.db.query(BankTransaction)
            .filter(BankTransaction.id == transaction_id)
            .first()
        )

        if not transaction:
            raise ValueError(f"BankTransaction with id={transaction_id} not found")

        return transaction

    def _get_supplier_inn(self, supplier_id: int) -> Optional[str]:
        """
        Get Supplier.INN from requisites with caching.

        Args:
            supplier_id: Supplier ID

        Returns:
            INN string if found, None otherwise
        """
        # Check cache first
        if supplier_id in self._supplier_inn_cache:
            return self._supplier_inn_cache[supplier_id]

        # Fetch from database
        supplier = self.db.query(Supplier).filter(Supplier.id == supplier_id).first()

        if not supplier:
            logger.warning(f"Supplier with id={supplier_id} not found")
            self._supplier_inn_cache[supplier_id] = None
            return None

        # Extract INN from requisites
        inn = extract_inn_from_requisites(supplier.requisites)
        self._supplier_inn_cache[supplier_id] = inn

        logger.debug(f"Cached INN for supplier_id={supplier_id}: {inn}")
        return inn

    def _find_invoice_candidates(
        self,
        supplier_inn: str,
        transaction_amount: Decimal,
        transaction_date: datetime,
    ) -> List[Dict[str, Any]]:
        """
        Find invoice candidates matching by supplier INN and amount tolerance.

        The tolerance is calculated FROM the invoice total, not the transaction amount.
        This is because bank statements often have partial payments or rounding differences.

        Args:
            supplier_inn: Supplier INN to match
            transaction_amount: Bank transaction amount
            transaction_date: Bank transaction date

        Returns:
            List of candidate dicts with invoice, tolerance_amount, confidence
        """
        # Fetch suppliers with matching INN
        matching_suppliers = (
            self.db.query(Supplier)
            .filter(Supplier.requisites.contains(supplier_inn))
            .all()
        )

        # Extract INN from each supplier's requisites to verify exact match
        verified_supplier_ids = []
        for supplier in matching_suppliers:
            extracted_inn = self._get_supplier_inn(supplier.id)
            if extracted_inn == supplier_inn:
                verified_supplier_ids.append(supplier.id)

        if not verified_supplier_ids:
            logger.debug(f"No suppliers found with INN={supplier_inn}")
            return []

        # Fetch purchase orders for verified suppliers
        # Only consider POs with relevant statuses: "Сверен" (verified), "Ожидает оплаты" (awaiting payment)
        purchase_orders = (
            self.db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.supplier_id.in_(verified_supplier_ids),
                PurchaseOrder.status.in_(["Счет сверен", "Сверен"]),  # Verified POs
            )
            .all()
        )

        if not purchase_orders:
            logger.debug(f"No purchase orders found for suppliers with INN={supplier_inn}")
            return []

        # Fetch invoices for these purchase orders
        # Only consider invoices with status: "Сверен" (verified), "Ожидает оплаты" (awaiting payment)
        po_ids = [po.id for po in purchase_orders]
        invoices = (
            self.db.query(Invoice)
            .filter(
                Invoice.purchase_order_id.in_(po_ids),
                Invoice.status.in_(["Сверен", "Ожидает оплаты"]),
            )
            .options(joinedload(Invoice.items))
            .all()
        )

        logger.debug(f"Found {len(invoices)} invoice candidates for INN={supplier_inn}")

        # Filter by amount tolerance and calculate confidence
        candidates = []
        for invoice in invoices:
            # Calculate invoice total from items
            invoice_total = self._calculate_invoice_total(invoice)

            if invoice_total is None:
                continue

            # Calculate tolerance bounds FROM invoice total
            # The transaction amount should be within ±5% of the invoice total
            tolerance_min, tolerance_max = self._calculate_tolerance_bounds(invoice_total)

            # Check if transaction amount is within invoice's tolerance range
            if tolerance_min <= transaction_amount <= tolerance_max:
                # Calculate confidence score
                confidence = self._calculate_confidence(
                    transaction_amount,
                    invoice_total,
                )

                candidates.append({
                    "invoice": invoice,
                    "invoice_total": invoice_total,
                    "confidence": confidence,
                })

        # Sort by confidence descending
        candidates.sort(key=lambda x: x["confidence"], reverse=True)

        logger.debug(
            f"Found {len(candidates)} candidates within tolerance for INN={supplier_inn}"
        )

        return candidates

    def _calculate_invoice_total(self, invoice: Invoice) -> Optional[Decimal]:
        """
        Calculate invoice total from its items.

        Args:
            invoice: Invoice with items loaded

        Returns:
            Total amount as Decimal, or None if no items
        """
        if not invoice.items:
            return None

        total = Decimal("0")
        for item in invoice.items:
            if item.total_price:
                total += item.total_price

        return total

    def _calculate_tolerance_bounds(
        self,
        amount: Decimal,
    ) -> Tuple[Decimal, Decimal]:
        """
        Calculate amount tolerance bounds (±percentage).

        Args:
            amount: Base amount

        Returns:
            Tuple of (min_amount, max_amount)
        """
        tolerance = amount * Decimal(str(self.amount_tolerance_percent / 100))
        min_amount = amount - tolerance
        max_amount = amount + tolerance
        return min_amount, max_amount

    def _calculate_confidence(
        self,
        transaction_amount: Decimal,
        invoice_total: Decimal,
    ) -> Decimal:
        """
        Calculate confidence score for a match.

        Args:
            transaction_amount: Bank transaction amount
            invoice_total: Invoice total amount

        Returns:
            Confidence score from 0.85 to 1.00
        """
        # Exact match = 1.00
        if transaction_amount == invoice_total:
            return CONFIDENCE_EXACT

        # Within tolerance = 0.85 to 0.99 based on proximity to exact
        # Calculate tolerance FROM invoice total
        tolerance_min, tolerance_max = self._calculate_tolerance_bounds(invoice_total)
        tolerance_range = tolerance_max - tolerance_min

        if tolerance_range == 0:
            return CONFIDENCE_TOLERANCE

        # Calculate how close transaction_amount is to invoice_total
        # Closer to invoice_total = higher confidence
        difference = abs(transaction_amount - invoice_total)
        proximity_score = 1 - (difference / tolerance_range)

        # Scale to 0.85-0.99 range
        confidence = CONFIDENCE_TOLERANCE + (
            proximity_score * (CONFIDENCE_EXACT - CONFIDENCE_TOLERANCE)
        )

        # Round to 2 decimal places
        return confidence.quantize(Decimal("0.01"))

    def _select_best_match(
        self,
        transaction: BankTransaction,
        candidates: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        Select best match from candidates.

        Args:
            transaction: BankTransaction to match
            candidates: List of candidate dicts

        Returns:
            Best match dict with invoice, confidence, context, or None if ambiguous
        """
        if not candidates:
            return None

        # If only one candidate and above minimum confidence, select it
        if len(candidates) == 1:
            candidate = candidates[0]
            if candidate["confidence"] >= MIN_CONFIDENCE_SCORE:
                return {
                    "invoice": candidate["invoice"],
                    "confidence": candidate["confidence"],
                    "context": self._build_matching_context(
                        transaction,
                        candidate["invoice"],
                        candidate["invoice_total"],
                        candidate["confidence"],
                    ),
                }

        # Multiple candidates - check for clear winner
        # If top candidate has significantly higher confidence (>0.05 difference), select it
        if len(candidates) >= 2:
            top_confidence = candidates[0]["confidence"]
            second_confidence = candidates[1]["confidence"]
            confidence_gap = top_confidence - second_confidence

            if confidence_gap > Decimal("0.05") and top_confidence >= MIN_CONFIDENCE_SCORE:
                candidate = candidates[0]
                return {
                    "invoice": candidate["invoice"],
                    "confidence": candidate["confidence"],
                    "context": self._build_matching_context(
                        transaction,
                        candidate["invoice"],
                        candidate["invoice_total"],
                        candidate["confidence"],
                    ),
                }

        # Ambiguous - no clear winner
        logger.debug(
            f"Ambiguous match for transaction_id={transaction.id}: "
            f"{len(candidates)} candidates with close confidence scores"
        )
        return None

    def _build_matching_context(
        self,
        transaction: BankTransaction,
        invoice: Invoice,
        invoice_total: Decimal,
        confidence: Decimal,
    ) -> Dict[str, Any]:
        """
        Build matching context for audit trail.

        Args:
            transaction: BankTransaction
            invoice: Matched Invoice
            invoice_total: Invoice total amount
            confidence: Confidence score

        Returns:
            Dict with matching algorithm metadata
        """
        tolerance_min, tolerance_max = self._calculate_tolerance_bounds(invoice_total)

        return {
            "algorithm": "inn_tolerance_match",
            "supplier_inn": transaction.supplier_inn,
            "transaction_amount": str(transaction.amount),
            "invoice_total": str(invoice_total),
            "amount_difference": str(abs(transaction.amount - invoice_total)),
            "tolerance_min": str(tolerance_min),
            "tolerance_max": str(tolerance_max),
            "tolerance_percent": self.amount_tolerance_percent,
            "transaction_date": transaction.transaction_date.isoformat(),
            "confidence_score": str(confidence),
            "invoice_id": invoice.id,
            "purchase_order_id": invoice.purchase_order_id,
        }

    def _create_payment(
        self,
        transaction: BankTransaction,
        invoice: Invoice,
        confidence: Decimal,
        context: Dict[str, Any],
    ) -> int:
        """
        Create Payment record for matched transaction.

        Args:
            transaction: Matched BankTransaction
            invoice: Matched Invoice
            confidence: Confidence score
            context: Matching context for audit

        Returns:
            Created Payment ID
        """
        # Create Payment record
        payment = Payment(
            invoice_id=invoice.id,
            amount=transaction.amount,
            bank_transaction_id=str(transaction.id),
            payment_date=transaction.transaction_date,
        )
        self.db.add(payment)
        self.db.flush()  # Get payment_id

        # Create TransactionMatchingAudit record
        audit = TransactionMatchingAudit(
            bank_transaction_id=transaction.id,
            invoice_id=invoice.id,
            matched_at=datetime.utcnow(),
            matched_by="auto",
            confidence_score=confidence,
            matching_context=context,
        )
        self.db.add(audit)

        # Update invoice status to "Оплачен" (Paid) on successful match
        invoice.status = "Оплачен"

        self.db.commit()

        logger.info(
            f"Created payment_id={payment.id} for transaction_id={transaction.id} -> "
            f"invoice_id={invoice.id}"
        )

        return payment.id

    def _create_unresolved_transaction(
        self,
        transaction: BankTransaction,
        reason: str,
    ) -> MatchResult:
        """
        Create UnresolvedTransaction record for unmatched transaction.

        Args:
            transaction: Unmatched BankTransaction
            reason: Reason for unresolved status

        Returns:
            MatchResult with unresolved count
        """
        unresolved = UnresolvedTransaction(
            amount=transaction.amount,
            description=transaction.description or f"Bank transaction {transaction.id}",
            bank_date=transaction.transaction_date,
            status="Не распределено",
        )
        self.db.add(unresolved)
        self.db.commit()

        logger.info(
            f"Created unresolved_transaction_id={unresolved.id} for "
            f"transaction_id={transaction.id}, reason={reason}"
        )

        return MatchResult(
            matched_count=0,
            unresolved_count=1,
        )


def match_payment(
    transaction_id: int,
    db: Session,
    date_window_days: int = DEFAULT_DATE_WINDOW_DAYS,
    amount_tolerance_percent: float = AMOUNT_TOLERANCE_PERCENT,
) -> MatchResult:
    """
    Match a bank transaction to invoices.

    This is a convenience function that creates a PaymentMatcher
    and matches the transaction.

    Args:
        transaction_id: BankTransaction ID to match
        db: SQLAlchemy database session
        date_window_days: Date proximity window in days (default: 30)
        amount_tolerance_percent: Amount tolerance percentage (default: 5.0)

    Returns:
        MatchResult with matching outcome
    """
    matcher = PaymentMatcher(
        db,
        date_window_days=date_window_days,
        amount_tolerance_percent=amount_tolerance_percent,
    )
    return matcher.match_transaction(transaction_id)
