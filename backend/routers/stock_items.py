"""
StockItem CRUD router for ZakupPro API.
Provides endpoints for managing warehouse inventory items.

RBAC:
- All roles: GET (read access for warehouse operations)
- owner, manager: POST/PUT/DELETE (write access)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import StockItem
from backend.schemas import StockItemCreate, StockItemUpdate, StockItemResponse, StockReceiveRequest
from backend.rbac import require_role, Role
from backend.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stock-items", tags=["stock-items"])


@router.get("", response_model=List[StockItemResponse])
def list_stock_items(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER, Role.WAREHOUSE])),
    db: Session = Depends(get_db)
):
    """
    List all stock items with pagination.
    All roles have read access.
    """
    items = db.query(StockItem).offset(skip).limit(limit).all()
    return items


@router.get("/{item_id}", response_model=StockItemResponse)
def get_stock_item(
    item_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER, Role.WAREHOUSE])),
    db: Session = Depends(get_db)
):
    """
    Get a single stock item by ID.
    All roles have read access.
    """
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StockItem with id {item_id} not found"
        )
    return item


@router.post("", response_model=StockItemResponse, status_code=status.HTTP_201_CREATED)
def create_stock_item(
    item_data: StockItemCreate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Create a new stock item.
    Requires owner or manager role.
    """
    new_item = StockItem(**item_data.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    logger.info(f"User {current_user.id} created stock item {new_item.id}")
    return new_item


@router.put("/{item_id}", response_model=StockItemResponse)
def update_stock_item(
    item_id: int,
    item_data: StockItemUpdate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing stock item.
    Requires owner or manager role.
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
    logger.info(f"User {current_user.id} updated stock item {item_id}")
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stock_item(
    item_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Delete a stock item (RESTRICT: fails if project_items exist).
    Requires owner or manager role.
    """
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StockItem with id {item_id} not found"
        )

    db.delete(item)
    db.commit()
    logger.info(f"User {current_user.id} deleted stock item {item_id}")


@router.post("/{item_id}/receive", response_model=StockItemResponse)
def receive_stock_item(
    item_id: int,
    receive_data: StockReceiveRequest,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER, Role.WAREHOUSE])),
    db: Session = Depends(get_db)
):
    """
    Receive goods into stock (goods receipt).
    Owner, manager, and warehouse roles per D036 decision.
    Accepts StockReceiveRequest body, calls receive_stock() service,
    returns updated StockItemResponse.
    """
    from backend.services.stock_service import receive_stock

    stock_item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not stock_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"StockItem with id {item_id} not found"
        )

    try:
        receive_stock(item_id, receive_data.qty, db)
        db.commit()
        db.refresh(stock_item)
        logger.info(
            "User %s received %s units of stock_item_id=%s",
            current_user.id, receive_data.qty, item_id,
        )
        return stock_item
    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
