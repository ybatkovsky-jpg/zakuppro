"""
Supplier CRUD router for ZakupPro API.
Provides endpoints for managing suppliers.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Supplier
from backend.schemas import SupplierCreate, SupplierUpdate, SupplierResponse

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("/", response_model=List[SupplierResponse])
def list_suppliers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all suppliers with pagination.
    """
    suppliers = db.query(Supplier).offset(skip).limit(limit).all()
    return suppliers


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """
    Get a single supplier by ID.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {supplier_id} not found"
        )
    return supplier


@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier_data: SupplierCreate, db: Session = Depends(get_db)):
    """
    Create a new supplier.
    """
    new_supplier = Supplier(**supplier_data.model_dump())
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return new_supplier


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(supplier_id: int, supplier_data: SupplierUpdate, db: Session = Depends(get_db)):
    """
    Update an existing supplier.
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
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    """
    Delete a supplier (RESTRICT: fails if purchase_orders or project_items exist).
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {supplier_id} not found"
        )

    db.delete(supplier)
    db.commit()
