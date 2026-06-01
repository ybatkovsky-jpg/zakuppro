"""
StockItem CRUD router for ZakupPro API.
Provides endpoints for managing warehouse inventory items.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import StockItem
from backend.schemas import StockItemCreate, StockItemUpdate, StockItemResponse

router = APIRouter(prefix="/api/stock-items", tags=["stock-items"])


@router.get("/", response_model=List[StockItemResponse])
def list_stock_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all stock items with pagination.
    """
    items = db.query(StockItem).offset(skip).limit(limit).all()
    return items


@router.get("/{item_id}", response_model=StockItemResponse)
def get_stock_item(item_id: int, db: Session = Depends(get_db)):
    """
    Get a single stock item by ID.
    """
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StockItem with id {item_id} not found"
        )
    return item


@router.post("/", response_model=StockItemResponse, status_code=status.HTTP_201_CREATED)
def create_stock_item(item_data: StockItemCreate, db: Session = Depends(get_db)):
    """
    Create a new stock item.
    """
    new_item = StockItem(**item_data.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


@router.put("/{item_id}", response_model=StockItemResponse)
def update_stock_item(item_id: int, item_data: StockItemUpdate, db: Session = Depends(get_db)):
    """
    Update an existing stock item.
    """
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StockItem with id {item_id} not found"
        )

    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock_item(item_id: int, db: Session = Depends(get_db)):
    """
    Delete a stock item (RESTRICT: fails if project_items exist).
    """
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StockItem with id {item_id} not found"
        )

    db.delete(item)
    db.commit()
