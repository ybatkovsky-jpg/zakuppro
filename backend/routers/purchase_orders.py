"""
PurchaseOrder CRUD router for ZakupPro API.

Provides endpoints for managing purchase orders with role-based access control.
- Owner: full CRUD access to all purchase orders
- Manager: CRUD access to purchase orders in own projects only
- Warehouse: no access (403 Forbidden)

Ownership chain: PurchaseOrder → Project (via project_id → Project.owner_id)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from backend.database import get_db
from backend.models import User, Project, PurchaseOrder, Role
from backend.schemas import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse
from backend.rbac import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


def _check_ownership(purchase_order: PurchaseOrder, current_user: User) -> None:
    """Verify user owns the project linked to this purchase order."""
    from backend.rbac import PermissionDenied
    if current_user.role == Role.OWNER:
        return
    if current_user.role == Role.MANAGER:
        if purchase_order.project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this resource",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )


@router.get("", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    List all purchase orders with pagination.

    Access Control:
        - Owner: sees all purchase orders
        - Manager: sees only purchase orders in own projects
        - Warehouse: 403 Forbidden
    """
    query = db.query(PurchaseOrder)

    # Manager: filter to own projects via PurchaseOrder.project.owner_id
    if current_user.role == Role.MANAGER:
        query = query.join(Project).filter(Project.owner_id == current_user.id)

    orders = query.offset(skip).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    order_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get a single purchase order by ID with eager-loaded invoices.

    Access Control:
        - Owner: can access any purchase order
        - Manager: can only access purchase orders in own projects
        - Warehouse: 403 Forbidden
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PurchaseOrder with id {order_id} not found"
        )
    _check_ownership(order, current_user)
    return order


@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    order_data: PurchaseOrderCreate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Create a new purchase order.

    Access Control:
        - Owner: can create purchase orders in any project
        - Manager: can create purchase orders in own projects only
        - Warehouse: 403 Forbidden
    """
    # Manager: verify they own the project being linked
    if current_user.role == Role.MANAGER:
        project = db.query(Project).filter(Project.id == order_data.project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with id {order_data.project_id} not found"
            )
        from backend.rbac import PermissionDenied
        if project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this project",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )

    new_order = PurchaseOrder(**order_data.model_dump())
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) created purchase order {new_order.id}")
    return new_order


@router.put("/{order_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    order_id: int,
    order_data: PurchaseOrderUpdate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing purchase order.

    Access Control:
        - Owner: can update any purchase order
        - Manager: can only update purchase orders in own projects
        - Warehouse: 403 Forbidden
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PurchaseOrder with id {order_id} not found"
        )
    _check_ownership(order, current_user)

    update_data = order_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) updated purchase order {order.id}")
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    order_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Delete a purchase order (cascade deletes invoices).

    Access Control:
        - Owner: can delete any purchase order
        - Manager: can only delete purchase orders in own projects
        - Warehouse: 403 Forbidden
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PurchaseOrder with id {order_id} not found"
        )
    _check_ownership(order, current_user)

    db.delete(order)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) deleted purchase order {order.id}")
    return None
