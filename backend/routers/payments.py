"""
Payment CRUD router for ZakupPro API.

Provides endpoints for managing payments with role-based access control.
- Owner: full CRUD access to all payments
- Manager: CRUD access to payments in own projects only
- Warehouse: no access (403 Forbidden)

Ownership chain: Payment → Invoice → PurchaseOrder → Project (via invoice_id → purchase_order_id → project_id → Project.owner_id)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from backend.database import get_db
from backend.models import User, Project, PurchaseOrder, Invoice, Payment, Role
from backend.schemas import PaymentCreate, PaymentUpdate, PaymentResponse
from backend.rbac import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])


def _check_ownership(payment: Payment, current_user: User) -> None:
    """Verify user owns the project linked to this payment via invoice → purchase_order chain."""
    from backend.rbac import PermissionDenied
    if current_user.role == Role.OWNER:
        return
    if current_user.role == Role.MANAGER:
        if payment.invoice.purchase_order.project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this resource",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )


@router.get("/", response_model=List[PaymentResponse])
def list_payments(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    List all payments with pagination.

    Access Control:
        - Owner: sees all payments
        - Manager: sees only payments in own projects (via invoice → purchase_order → project chain)
        - Warehouse: 403 Forbidden
    """
    query = db.query(Payment)

    # Manager: filter to own projects via Payment → Invoice → PurchaseOrder → Project chain
    if current_user.role == Role.MANAGER:
        query = query.join(Invoice).join(PurchaseOrder).join(Project).filter(Project.owner_id == current_user.id)

    payments = query.offset(skip).limit(limit).all()
    return payments


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get a single payment by ID.

    Access Control:
        - Owner: can access any payment
        - Manager: can only access payments in own projects
        - Warehouse: 403 Forbidden
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found"
        )
    _check_ownership(payment, current_user)
    return payment


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    payment_data: PaymentCreate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Create a new payment.

    Access Control:
        - Owner: can create payments for any invoice
        - Manager: can create payments only for invoices in own projects
        - Warehouse: 403 Forbidden
    """
    # Manager: verify they own the project linked to the invoice
    if current_user.role == Role.MANAGER:
        inv = db.query(Invoice).filter(Invoice.id == payment_data.invoice_id).first()
        if not inv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice with id {payment_data.invoice_id} not found"
            )
        from backend.rbac import PermissionDenied
        if inv.purchase_order.project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this project",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )

    new_payment = Payment(**payment_data.model_dump())
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) created payment {new_payment.id}")
    return new_payment


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    payment_data: PaymentUpdate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing payment.

    Access Control:
        - Owner: can update any payment
        - Manager: can only update payments in own projects
        - Warehouse: 403 Forbidden
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found"
        )
    _check_ownership(payment, current_user)

    update_data = payment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)

    db.commit()
    db.refresh(payment)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) updated payment {payment.id}")
    return payment


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    payment_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Delete a payment.

    Access Control:
        - Owner: can delete any payment
        - Manager: can only delete payments in own projects
        - Warehouse: 403 Forbidden
    """
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found"
        )
    _check_ownership(payment, current_user)

    db.delete(payment)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) deleted payment {payment.id}")
    return None
