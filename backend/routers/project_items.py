"""
ProjectItem CRUD router for ZakupPro API.
Provides endpoints for managing project items (BOM).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import ProjectItem
from backend.schemas import ProjectItemCreate, ProjectItemUpdate, ProjectItemResponse
from backend.services import stock_service

router = APIRouter(prefix="/api/project-items", tags=["project-items"])


@router.get("/", response_model=List[ProjectItemResponse])
def list_project_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all project items with pagination.
    """
    items = db.query(ProjectItem).offset(skip).limit(limit).all()
    return items


@router.get("/{item_id}", response_model=ProjectItemResponse)
def get_project_item(item_id: int, db: Session = Depends(get_db)):
    """
    Get a single project item by ID with eager-loaded relationships.
    """
    item = db.query(ProjectItem).filter(ProjectItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProjectItem with id {item_id} not found"
        )
    return item


@router.post("/", response_model=ProjectItemResponse, status_code=status.HTTP_201_CREATED)
def create_project_item(item_data: ProjectItemCreate, db: Session = Depends(get_db)):
    """
    Create a new project item.
    """
    new_item = ProjectItem(**item_data.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    stock_service.reserve_for_project(new_item.project_id, db)
    db.commit()
    return new_item


@router.put("/{item_id}", response_model=ProjectItemResponse)
def update_project_item(item_id: int, item_data: ProjectItemUpdate, db: Session = Depends(get_db)):
    """
    Update an existing project item.
    """
    item = db.query(ProjectItem).filter(ProjectItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProjectItem with id {item_id} not found"
        )

    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    stock_service.reserve_for_project(item.project_id, db)
    db.commit()
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_item(item_id: int, db: Session = Depends(get_db)):
    """
    Delete a project item.
    """
    item = db.query(ProjectItem).filter(ProjectItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProjectItem with id {item_id} not found"
        )

    db.delete(item)
    db.commit()
