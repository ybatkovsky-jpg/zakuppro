"""
ProductionTask CRUD router for ZakupPro API.
Provides endpoints for managing production/assembly tasks.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import ProductionTask
from backend.schemas import ProductionTaskCreate, ProductionTaskUpdate, ProductionTaskResponse

router = APIRouter(prefix="/api/production-tasks", tags=["production-tasks"])


@router.get("/", response_model=List[ProductionTaskResponse])
def list_production_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all production tasks with pagination.
    """
    tasks = db.query(ProductionTask).offset(skip).limit(limit).all()
    return tasks


@router.get("/{task_id}", response_model=ProductionTaskResponse)
def get_production_task(task_id: int, db: Session = Depends(get_db)):
    """
    Get a single production task by ID.
    """
    task = db.query(ProductionTask).filter(ProductionTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductionTask with id {task_id} not found"
        )
    return task


@router.post("/", response_model=ProductionTaskResponse, status_code=status.HTTP_201_CREATED)
def create_production_task(task_data: ProductionTaskCreate, db: Session = Depends(get_db)):
    """
    Create a new production task.
    """
    new_task = ProductionTask(**task_data.model_dump())
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@router.put("/{task_id}", response_model=ProductionTaskResponse)
def update_production_task(task_id: int, task_data: ProductionTaskUpdate, db: Session = Depends(get_db)):
    """
    Update an existing production task.
    """
    task = db.query(ProductionTask).filter(ProductionTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductionTask with id {task_id} not found"
        )

    update_data = task_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production_task(task_id: int, db: Session = Depends(get_db)):
    """
    Delete a production task.
    """
    task = db.query(ProductionTask).filter(ProductionTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductionTask with id {task_id} not found"
        )

    db.delete(task)
    db.commit()
