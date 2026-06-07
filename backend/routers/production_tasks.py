"""
ProductionTask CRUD router for ZakupPro API.

Provides endpoints for managing production/assembly tasks with role-based access control.
- Owner: full CRUD access to all production tasks
- Manager: CRUD access to tasks in own projects only
- Warehouse: no access (403 Forbidden)

Ownership chain: ProductionTask → Project (via project_id → Project.owner_id)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from backend.database import get_db
from backend.models import User, Project, ProductionTask, Role
from backend.schemas import ProductionTaskCreate, ProductionTaskUpdate, ProductionTaskResponse
from backend.rbac import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/production-tasks", tags=["production-tasks"])


def _check_ownership(task: ProductionTask, current_user: User) -> None:
    """Verify user owns the project linked to this production task."""
    from backend.rbac import PermissionDenied
    if current_user.role == Role.OWNER:
        return
    if current_user.role == Role.MANAGER:
        if task.project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this resource",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )


@router.get("", response_model=List[ProductionTaskResponse])
def list_production_tasks(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    List all production tasks with pagination.

    Access Control:
        - Owner: sees all production tasks
        - Manager: sees only tasks in own projects
        - Warehouse: 403 Forbidden
    """
    query = db.query(ProductionTask)

    # Manager: filter to own projects via ProductionTask.project.owner_id
    if current_user.role == Role.MANAGER:
        query = query.join(Project).filter(Project.owner_id == current_user.id)

    tasks = query.offset(skip).limit(limit).all()
    return tasks


@router.get("/{task_id}", response_model=ProductionTaskResponse)
def get_production_task(
    task_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get a single production task by ID.

    Access Control:
        - Owner: can access any production task
        - Manager: can only access tasks in own projects
        - Warehouse: 403 Forbidden
    """
    task = db.query(ProductionTask).filter(ProductionTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductionTask with id {task_id} not found"
        )
    _check_ownership(task, current_user)
    return task


@router.post("", response_model=ProductionTaskResponse, status_code=status.HTTP_201_CREATED)
def create_production_task(
    task_data: ProductionTaskCreate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Create a new production task.

    Access Control:
        - Owner: can create tasks in any project
        - Manager: can create tasks only in own projects
        - Warehouse: 403 Forbidden
    """
    # Manager: verify they own the project being linked
    if current_user.role == Role.MANAGER:
        project = db.query(Project).filter(Project.id == task_data.project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with id {task_data.project_id} not found"
            )
        from backend.rbac import PermissionDenied
        if project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this project",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )

    new_task = ProductionTask(**task_data.model_dump())
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) created production task {new_task.id}")
    return new_task


@router.put("/{task_id}", response_model=ProductionTaskResponse)
def update_production_task(
    task_id: int,
    task_data: ProductionTaskUpdate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing production task.

    Access Control:
        - Owner: can update any production task
        - Manager: can only update tasks in own projects
        - Warehouse: 403 Forbidden
    """
    task = db.query(ProductionTask).filter(ProductionTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductionTask with id {task_id} not found"
        )
    _check_ownership(task, current_user)

    update_data = task_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) updated production task {task.id}")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production_task(
    task_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Delete a production task.

    Access Control:
        - Owner: can delete any production task
        - Manager: can only delete tasks in own projects
        - Warehouse: 403 Forbidden
    """
    task = db.query(ProductionTask).filter(ProductionTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProductionTask with id {task_id} not found"
        )
    _check_ownership(task, current_user)

    db.delete(task)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) deleted production task {task.id}")
    return None
