"""
UnresolvedTransaction CRUD router for ZakupPro API.
Provides endpoints for managing unresolved bank transactions.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import UnresolvedTransaction
from backend.schemas import UnresolvedTransactionCreate, UnresolvedTransactionUpdate, UnresolvedTransactionResponse

router = APIRouter(prefix="/api/unresolved-transactions", tags=["unresolved-transactions"])


@router.get("/", response_model=List[UnresolvedTransactionResponse])
def list_unresolved_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all unresolved transactions with pagination.
    """
    transactions = db.query(UnresolvedTransaction).offset(skip).limit(limit).all()
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
