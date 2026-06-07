"""
Supplier CRUD router for ZakupPro API.
Provides endpoints for managing suppliers.

RBAC:
- GET: All roles (warehouse has read-only access)
- POST/PUT/DELETE: owner only (managers have read-only access, warehouse is denied)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Supplier
from backend.schemas import SupplierCreate, SupplierUpdate, SupplierResponse
from backend.rbac import require_role, Role
from backend.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("", response_model=List[SupplierResponse])
def list_suppliers(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    List all suppliers with pagination.
    Owner and manager have read access.
    """
    suppliers = db.query(Supplier).offset(skip).limit(limit).all()
    return suppliers


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get a single supplier by ID.
    Owner and manager have read access.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {supplier_id} not found"
        )
    return supplier


@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    supplier_data: SupplierCreate,
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db)
):
    """
    Create a new supplier.
    Owner role only.
    """
    new_supplier = Supplier(**supplier_data.model_dump())
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    logger.info(f"User {current_user.id} created supplier {new_supplier.id}")
    return new_supplier


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    supplier_data: SupplierUpdate,
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing supplier.
    Owner role only.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {supplier_id} not found"
        )

    update_data = supplier_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)

    db.commit()
    db.refresh(supplier)
    logger.info(f"User {current_user.id} updated supplier {supplier_id}")
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: int,
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db)
):
    """
    Delete a supplier (RESTRICT: fails if purchase_orders or project_items exist).
    Owner role only.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {supplier_id} not found"
        )

    db.delete(supplier)
    db.commit()
    logger.info(f"User {current_user.id} deleted supplier {supplier_id}")
