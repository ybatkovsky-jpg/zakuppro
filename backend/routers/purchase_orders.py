"""
PurchaseOrder CRUD router for ZakupPro API.
Provides endpoints for managing purchase orders.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import PurchaseOrder
from backend.schemas import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase-orders"])


@router.get("/", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all purchase orders with pagination.
    """
    orders = db.query(PurchaseOrder).offset(skip).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(order_id: int, db: Session = Depends(get_db)):
    """
    Get a single purchase order by ID with eager-loaded invoices.
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PurchaseOrder with id {order_id} not found"
        )
    return order


@router.post("/", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(order_data: PurchaseOrderCreate, db: Session = Depends(get_db)):
    """
    Create a new purchase order.
    """
    new_order = PurchaseOrder(**order_data.model_dump())
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order


@router.put("/{order_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(order_id: int, order_data: PurchaseOrderUpdate, db: Session = Depends(get_db)):
    """
    Update an existing purchase order.
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PurchaseOrder with id {order_id} not found"
        )

    update_data = order_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(order_id: int, db: Session = Depends(get_db)):
    """
    Delete a purchase order (cascade deletes invoices).
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PurchaseOrder with id {order_id} not found"
        )

    db.delete(order)
    db.commit()
