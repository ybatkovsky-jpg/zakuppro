"""
ProjectItem CRUD router for ZakupPro API.

Provides endpoints for managing project items (BOM) with role-based access control.
- Owner: full CRUD access to all project items
- Manager: CRUD access to items in own projects only
- Warehouse: no access (403 Forbidden)

Ownership chain: ProjectItem → Project (via project_id → Project.owner_id)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from backend.database import get_db
from backend.models import User, Project, ProjectItem, Role
from backend.schemas import ProjectItemCreate, ProjectItemUpdate, ProjectItemResponse
from backend.services import stock_service
from backend.rbac import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/project-items", tags=["project-items"])


def _check_ownership(item: ProjectItem, current_user: User) -> None:
    """Verify user owns the project linked to this project item."""
    from backend.rbac import PermissionDenied
    if current_user.role == Role.OWNER:
        return
    if current_user.role == Role.MANAGER:
        if item.project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this resource",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )


@router.get("", response_model=List[ProjectItemResponse])
def list_project_items(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    List all project items with pagination.

    Access Control:
        - Owner: sees all project items
        - Manager: sees only items in own projects
        - Warehouse: 403 Forbidden
    """
    query = db.query(ProjectItem)

    # Manager: filter to own projects via ProjectItem.project.owner_id
    if current_user.role == Role.MANAGER:
        query = query.join(Project).filter(Project.owner_id == current_user.id)

    items = query.offset(skip).limit(limit).all()
    return items


@router.get("/{item_id}", response_model=ProjectItemResponse)
def get_project_item(
    item_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get a single project item by ID with eager-loaded relationships.

    Access Control:
        - Owner: can access any project item
        - Manager: can only access items in own projects
        - Warehouse: 403 Forbidden
    """
    item = db.query(ProjectItem).filter(ProjectItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProjectItem with id {item_id} not found"
        )
    _check_ownership(item, current_user)
    return item


@router.post("", response_model=ProjectItemResponse, status_code=status.HTTP_201_CREATED)
def create_project_item(
    item_data: ProjectItemCreate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Create a new project item.

    Access Control:
        - Owner: can create items in any project
        - Manager: can create items only in own projects
        - Warehouse: 403 Forbidden
    """
    # Manager: verify they own the project being linked
    if current_user.role == Role.MANAGER:
        project = db.query(Project).filter(Project.id == item_data.project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with id {item_data.project_id} not found"
            )
        from backend.rbac import PermissionDenied
        if project.owner_id != current_user.id:
            raise PermissionDenied(
                detail="Access denied: you do not own this project",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"owner_id == {current_user.id}"
            )

    new_item = ProjectItem(**item_data.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    stock_service.reserve_for_project(new_item.project_id, db)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) created project item {new_item.id}")
    return new_item


@router.put("/{item_id}", response_model=ProjectItemResponse)
def update_project_item(
    item_id: int,
    item_data: ProjectItemUpdate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing project item.

    Access Control:
        - Owner: can update any project item
        - Manager: can only update items in own projects
        - Warehouse: 403 Forbidden
    """
    item = db.query(ProjectItem).filter(ProjectItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProjectItem with id {item_id} not found"
        )
    _check_ownership(item, current_user)

    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    stock_service.reserve_for_project(item.project_id, db)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) updated project item {item.id}")
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_item(
    item_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Delete a project item.

    Access Control:
        - Owner: can delete any project item
        - Manager: can only delete items in own projects
        - Warehouse: 403 Forbidden
    """
    item = db.query(ProjectItem).filter(ProjectItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ProjectItem with id {item_id} not found"
        )
    _check_ownership(item, current_user)

    db.delete(item)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) deleted project item {item.id}")
    return None
