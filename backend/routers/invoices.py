"""
Invoice CRUD router for ZakupPro API.

Provides endpoints for managing supplier invoices with role-based access control.
- Owner: full CRUD access to all invoices
- Manager: CRUD access to invoices in own projects only
- Warehouse: no access (403 Forbidden)

Ownership chain: Invoice → PurchaseOrder → Project (via purchase_order_id → project_id → Project.owner_id)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from backend.database import get_db
from backend.models import User, Project, PurchaseOrder, Invoice, Role
from backend.schemas import InvoiceCreate, InvoiceUpdate, InvoiceResponse
from backend.rbac import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/invoices", tags=["invoices"])


def _check_ownership(invoice: Invoice, current_user: User) -> None:
    """Verify user owns the project linked to this invoice via purchase_order."""
    from backend.rbac import PermissionDenied
    if current_user.role == Role.OWNER:
        return
    if current_user.role == Role.MANAGER:
        if invoice.purchase_order.project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this resource",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )


@router.get("/", response_model=List[InvoiceResponse])
def list_invoices(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    List all invoices with pagination.

    Access Control:
        - Owner: sees all invoices
        - Manager: sees only invoices in own projects (via purchase_order → project chain)
        - Warehouse: 403 Forbidden
    """
    query = db.query(Invoice)

    # Manager: filter to own projects via Invoice → PurchaseOrder → Project chain
    if current_user.role == Role.MANAGER:
        query = query.join(PurchaseOrder).join(Project).filter(Project.owner_id == current_user.id)

    invoices = query.offset(skip).limit(limit).all()
    return invoices


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get a single invoice by ID with eager-loaded payments.

    Access Control:
        - Owner: can access any invoice
        - Manager: can only access invoices in own projects
        - Warehouse: 403 Forbidden
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with id {invoice_id} not found"
        )
    _check_ownership(invoice, current_user)
    return invoice


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_data: InvoiceCreate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Create a new invoice.

    Access Control:
        - Owner: can create invoices in any purchase order
        - Manager: can create invoices only in own projects' purchase orders
        - Warehouse: 403 Forbidden
    """
    # Manager: verify they own the project linked to the purchase order
    if current_user.role == Role.MANAGER:
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == invoice_data.purchase_order_id).first()
        if not po:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PurchaseOrder with id {invoice_data.purchase_order_id} not found"
            )
        from backend.rbac import PermissionDenied
        if po.project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this project",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )

    new_invoice = Invoice(**invoice_data.model_dump())
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) created invoice {new_invoice.id}")
    return new_invoice


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    invoice_data: InvoiceUpdate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing invoice.

    Access Control:
        - Owner: can update any invoice
        - Manager: can only update invoices in own projects
        - Warehouse: 403 Forbidden
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with id {invoice_id} not found"
        )
    _check_ownership(invoice, current_user)

    update_data = invoice_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(invoice, field, value)

    db.commit()
    db.refresh(invoice)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) updated invoice {invoice.id}")
    return invoice


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Delete an invoice (cascade deletes payments).

    Access Control:
        - Owner: can delete any invoice
        - Manager: can only delete invoices in own projects
        - Warehouse: 403 Forbidden
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with id {invoice_id} not found"
        )
    _check_ownership(invoice, current_user)

    db.delete(invoice)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) deleted invoice {invoice.id}")
    return None
