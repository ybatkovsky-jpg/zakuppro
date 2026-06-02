"""
UnresolvedTransaction CRUD router for ZakupPro API.
Provides endpoints for managing unresolved bank transactions.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
import logging

from backend.database import get_db
from backend.models import UnresolvedTransaction, Supplier, PurchaseOrder, Invoice, InvoiceItem
from backend.schemas import (
    UnresolvedTransactionCreate,
    UnresolvedTransactionUpdate,
    UnresolvedTransactionResponse,
    InvoiceCandidateResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/unresolved-transactions", tags=["unresolved-transactions"])


@router.get("/", response_model=List[UnresolvedTransactionResponse])
def list_unresolved_transactions(
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    status: Optional[str] = Query(None, description="Filter by status (e.g., 'Не распределено', 'Привязано вручную')"),
    amount_min: Optional[float] = Query(None, ge=0, description="Minimum amount filter (inclusive)"),
    amount_max: Optional[float] = Query(None, ge=0, description="Maximum amount filter (inclusive)"),
    date_from: Optional[datetime] = Query(None, description="Filter transactions from this date (inclusive)"),
    date_to: Optional[datetime] = Query(None, description="Filter transactions until this date (inclusive)"),
    search: Optional[str] = Query(None, description="Search in description field (case-insensitive partial match)"),
    order_by: Optional[str] = Query("bank_date", description="Field to order by (id, amount, bank_date, created_at)"),
    order_dir: Optional[str] = Query("desc", description="Sort direction: 'asc' or 'desc'"),
    db: Session = Depends(get_db)
):
    """
    List unresolved transactions with filtering, search, and pagination.

    Filters:
    - status: Filter by transaction status
    - amount_min/amount_max: Filter by amount range
    - date_from/date_to: Filter by bank date range
    - search: Case-insensitive search in description field

    Ordering:
    - order_by: Field name (id, amount, bank_date, created_at)
    - order_dir: Direction ('asc' or 'desc')
    """
    logger.info(
        "list_unresolved_transactions called with filters: skip=%s, limit=%s, status=%s, "
        "amount_min=%s, amount_max=%s, date_from=%s, date_to=%s, search=%s, order_by=%s, order_dir=%s",
        skip, limit, status, amount_min, amount_max, date_from, date_to, search, order_by, order_dir
    )

    query = db.query(UnresolvedTransaction)

    # Apply filters
    if status:
        query = query.filter(UnresolvedTransaction.status == status)
        logger.debug(f"Applied status filter: {status}")

    if amount_min is not None:
        query = query.filter(UnresolvedTransaction.amount >= amount_min)
        logger.debug(f"Applied amount_min filter: {amount_min}")

    if amount_max is not None:
        query = query.filter(UnresolvedTransaction.amount <= amount_max)
        logger.debug(f"Applied amount_max filter: {amount_max}")

    if date_from:
        query = query.filter(UnresolvedTransaction.bank_date >= date_from)
        logger.debug(f"Applied date_from filter: {date_from}")

    if date_to:
        query = query.filter(UnresolvedTransaction.bank_date <= date_to)
        logger.debug(f"Applied date_to filter: {date_to}")

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(UnresolvedTransaction.description.ilike(search_pattern))
        logger.debug(f"Applied search filter: {search}")

    # Validate and apply ordering
    valid_order_fields = {"id", "amount", "bank_date", "created_at"}
    if order_by not in valid_order_fields:
        order_by = "bank_date"
        logger.debug(f"Invalid order_by '{order_by}', defaulted to 'bank_date'")

    order_column = getattr(UnresolvedTransaction, order_by)

    if order_dir == "asc":
        query = query.order_by(order_column.asc())
    else:
        query = query.order_by(order_column.desc())

    logger.debug(f"Applied ordering: {order_by} {order_dir}")

    # Apply pagination
    total_count = query.count()
    transactions = query.offset(skip).limit(limit).all()

    logger.info(f"Returning {len(transactions)} of {total_count} unresolved transactions")

    return transactions


@router.get("/{transaction_id}", response_model=UnresolvedTransactionResponse)
def get_unresolved_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """
    Get a single unresolved transaction by ID.
    """
    transaction = db.query(UnresolvedTransaction).filter(UnresolvedTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"UnresolvedTransaction with id {transaction_id} not found"
        )
    return transaction


@router.post("/", response_model=UnresolvedTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_unresolved_transaction(transaction_data: UnresolvedTransactionCreate, db: Session = Depends(get_db)):
    """
    Create a new unresolved transaction.
    """
    new_transaction = UnresolvedTransaction(**transaction_data.model_dump())
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return new_transaction


@router.put("/{transaction_id}", response_model=UnresolvedTransactionResponse)
def update_unresolved_transaction(transaction_id: int, transaction_data: UnresolvedTransactionUpdate, db: Session = Depends(get_db)):
    """
    Update an existing unresolved transaction.
    """
    transaction = db.query(UnresolvedTransaction).filter(UnresolvedTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"UnresolvedTransaction with id {transaction_id} not found"
        )

    update_data = transaction_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)

    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unresolved_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """
    Delete an unresolved transaction.
    """
    transaction = db.query(UnresolvedTransaction).filter(UnresolvedTransaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"UnresolvedTransaction with id {transaction_id} not found"
        )

    db.delete(transaction)
    db.commit()


@router.get("/{transaction_id}/candidates", response_model=List[InvoiceCandidateResponse])
def get_invoice_candidates(transaction_id: int, db: Session = Depends(get_db)):
    """
    Get invoice candidate suggestions for an unresolved transaction.

    Uses relaxed matching tolerances (10% amount, 90 days) to suggest
    potential invoices for manual reconciliation.

    Returns candidates with invoice_id, supplier_name, invoice_total,
    amount_difference, and confidence_score.
    """
    logger.info(f"get_invoice_candidates called for transaction_id={transaction_id}")

    # Fetch the unresolved transaction
    transaction = db.query(UnresolvedTransaction).filter(UnresolvedTransaction.id == transaction_id).first()
    if not transaction:
        logger.warning(f"UnresolvedTransaction with id {transaction_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"UnresolvedTransaction with id {transaction_id} not found"
        )

    # Relaxed tolerances for suggestions
    amount_tolerance_percent = 10.0
    date_window_days = 90

    transaction_amount = Decimal(str(transaction.amount))
    transaction_date = transaction.bank_date

    logger.debug(
        f"Searching candidates: amount={transaction_amount}, date={transaction_date}, "
        f"tolerance={amount_tolerance_percent}%, window={date_window_days} days"
    )

    # Find all invoices with items (need invoice total from items)
    # Only consider invoices with relevant statuses
    invoices = (
        db.query(Invoice)
        .filter(Invoice.status.in_(["Сверен", "Ожидает оплаты", "Оплачен"]))
        .options(joinedload(Invoice.items).joinedload(InvoiceItem.project_item))
        .all()
    )

    logger.debug(f"Found {len(invoices)} invoices with relevant statuses")

    candidates = []

    for invoice in invoices:
        # Calculate invoice total from items
        invoice_total = Decimal("0")
        if invoice.items:
            for item in invoice.items:
                if item.total_price:
                    invoice_total += Decimal(str(item.total_price))
        else:
            continue  # Skip invoices without items

        # Calculate tolerance bounds from invoice total
        tolerance = invoice_total * Decimal(str(amount_tolerance_percent / 100))
        tolerance_min = invoice_total - tolerance
        tolerance_max = invoice_total + tolerance

        # Check if transaction amount is within tolerance range
        if not (tolerance_min <= transaction_amount <= tolerance_max):
            continue

        # Check date proximity
        # Use invoice.created_at as proxy for invoice date
        # Ensure transaction_date is a date object for comparison
        transaction_date_only = transaction_date.date() if isinstance(transaction_date, datetime) else transaction_date
        invoice_date_only = invoice.created_at.date() if isinstance(invoice.created_at, datetime) else invoice.created_at

        date_min = transaction_date_only - timedelta(days=date_window_days)
        date_max = transaction_date_only + timedelta(days=date_window_days)

        if not (date_min <= invoice_date_only <= date_max):
            # Date is outside window but still include candidate
            # (just log it - suggestions are meant to be permissive)
            logger.debug(
                f"Invoice {invoice.id} outside date window: {invoice_date_only} "
                f"not in [{date_min}, {date_max}]"
            )

        # Calculate confidence score
        if transaction_amount == invoice_total:
            confidence = 1.00
        else:
            # Scale confidence based on amount proximity
            amount_diff = abs(transaction_amount - invoice_total)
            tolerance_range = tolerance_max - tolerance_min
            if tolerance_range > 0:
                proximity_score = 1 - float(amount_diff / tolerance_range)
                confidence = 0.75 + (proximity_score * 0.25)  # Scale to 0.75-1.00 range
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
            confidence_score=round(confidence, 2)
        ))

    # Sort by confidence score descending
    candidates.sort(key=lambda x: x.confidence_score, reverse=True)

    logger.info(f"Returning {len(candidates)} candidates for transaction_id={transaction_id}")

    return candidates
