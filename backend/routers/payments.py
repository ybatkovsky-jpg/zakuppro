"""
Payment CRUD router for ZakupPro API.
Provides endpoints for managing payments.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Payment
from backend.schemas import PaymentCreate, PaymentUpdate, PaymentResponse

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/", response_model=List[PaymentResponse])
def list_payments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all payments with pagination.
    """
    payments = db.query(Payment).offset(skip).limit(limit).all()
    return payments


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    """
    Get a single payment by ID.
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found"
        )
    return payment


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(payment_data: PaymentCreate, db: Session = Depends(get_db)):
    """
    Create a new payment.
    """
    new_payment = Payment(**payment_data.model_dump())
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    return new_payment


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(payment_id: int, payment_data: PaymentUpdate, db: Session = Depends(get_db)):
    """
    Update an existing payment.
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found"
        )

    update_data = payment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)

    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    """
    Delete a payment.
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found"
        )

    db.delete(payment)
    db.commit()
