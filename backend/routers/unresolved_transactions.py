"""
UnresolvedTransaction CRUD router for ZakupPro API.
Provides endpoints for managing unresolved bank transactions.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime
import logging

from backend.database import get_db
from backend.models import UnresolvedTransaction
from backend.schemas import UnresolvedTransactionCreate, UnresolvedTransactionUpdate, UnresolvedTransactionResponse

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
