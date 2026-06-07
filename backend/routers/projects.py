"""
Project CRUD router for ZakupPro API.

Provides endpoints for managing projects and their items with role-based access control.
- Owner: full CRUD access to all projects
- Manager: full CRUD access to own projects only (owner_id == user.id)
- Warehouse: no access (403 Forbidden)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from backend.database import get_db
from backend.models import User, Project, ProjectItem, ProjectStatusHistory
from backend.schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectReadinessResponse
from backend.auth import get_current_user
from backend.rbac import require_role, require_ownership, apply_ownership_filter
from backend.services import stock_service, transition_service
from backend.services.transition_service import PRODUCTION_READY_STATUSES
from backend.models import Role
import time

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    List all projects with pagination.

    Access Control:
        - Owner: sees all projects
        - Manager: sees only own projects (owner_id == user.id)
        - Warehouse: 403 Forbidden (no project access)

    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return
        current_user: Authenticated user from JWT token
        db: Database session

    Returns:
        List of projects filtered by ownership
    """
    query = db.query(Project)

    # Apply ownership filter based on user role
    query = apply_ownership_filter(query, Project, current_user.id, current_user.role)

    projects = query.offset(skip).limit(limit).all()
    return projects


@router.get("/readiness", response_model=list[ProjectReadinessResponse])
def project_readiness(
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Readiness matrix for all accessible projects.

    Returns per-project red/yellow/green readiness computed from ProjectItem
    status counts. Green = all items in PRODUCTION_READY_STATUSES.
    Yellow = no 'К закупке' but some items not yet ready.
    Red = any 'К закупке' item. Empty project → green.

    Access Control:
        - Owner: sees all projects
        - Manager: sees only own projects
        - Warehouse: 403 Forbidden
    """
    start = time.time()

    query = db.query(Project)
    query = apply_ownership_filter(query, Project, current_user.id, current_user.role)
    projects = query.all()

    if not projects:
        logger.info(
            "readiness: computed for 0 projects in %.2fms",
            (time.time() - start) * 1000,
        )
        return []

    # Collect all project IDs for a single GROUP BY query
    project_ids = [p.id for p in projects]
    from sqlalchemy import func
    status_rows = (
        db.query(
            ProjectItem.project_id,
            ProjectItem.status,
            func.count(ProjectItem.id).label("cnt"),
        )
        .filter(ProjectItem.project_id.in_(project_ids))
        .group_by(ProjectItem.project_id, ProjectItem.status)
        .all()
    )

    # Build per-project status counts
    # {project_id: {status: count}}
    status_map: dict[int, dict[str, int]] = {}
    for pid, status, cnt in status_rows:
        status_map.setdefault(pid, {})[status or ""] = cnt

    results: list[ProjectReadinessResponse] = []
    for project in projects:
        breakdown = status_map.get(project.id, {})
        total = sum(breakdown.values())
        ready = sum(
            cnt for s, cnt in breakdown.items()
            if s in PRODUCTION_READY_STATUSES
        )
        has_k_zakupke = "К закупке" in breakdown
        not_yet_ready = total - ready

        if total == 0 or not_yet_ready == 0:
            readiness = "green"
        elif has_k_zakupke:
            readiness = "red"
        else:
            readiness = "yellow"

        results.append(ProjectReadinessResponse(
            project_id=project.id,
            project_name=project.name,
            readiness=readiness,
            ready_count=ready,
            total_count=total,
            breakdown=breakdown,
        ))

    elapsed_ms = (time.time() - start) * 1000
    logger.info(
        "readiness: computed for %d projects in %.2fms",
        len(projects), elapsed_ms,
    )
    return results


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get a single project by ID with eager-loaded items.

    Access Control:
        - Owner: can access any project
        - Manager: can only access own projects (owner_id == user.id)
        - Warehouse: 403 Forbidden (no project access)

    Args:
        project_id: The project ID
        current_user: Authenticated user from JWT token
        db: Database session

    Returns:
        Project with items array

    Raises:
        HTTPException 404: If project not found
        HTTPException 403: If user lacks ownership (manager only)
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    # Verify ownership (owner bypass, manager must own)
    require_ownership(project, current_user.id, current_user.role)

    return project


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Create a new project.

    Access Control:
        - Owner: can create projects for any owner
        - Manager: can create projects (assigned to themselves)
        - Warehouse: 403 Forbidden (no project access)

    The project's owner_id is set to the current user's ID.

    Args:
        project_data: Project creation data
        current_user: Authenticated user with owner or manager role
        db: Database session

    Returns:
        Created project with assigned id
    """
    new_project = Project(**project_data.model_dump(), owner_id=current_user.id)
    # Auto-generate contract_number if not provided
    if not new_project.contract_number:
        new_project.contract_number = Project.generate_contract_number(db)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) created project {new_project.id}")
    return new_project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Update an existing project.

    Access Control:
        - Owner: can update any project
        - Manager: can only update own projects (owner_id == user.id)
        - Warehouse: 403 Forbidden (no project access)

    Args:
        project_id: The project ID
        project_data: Project update data (partial)
        current_user: Authenticated user with owner or manager role
        db: Database session

    Returns:
        Updated project

    Raises:
        HTTPException 404: If project not found
        HTTPException 403: If user lacks ownership (manager only)
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    # Verify ownership (owner bypass, manager must own)
    require_ownership(project, current_user.id, current_user.role)

    old_status = project.status

    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    new_status = project.status

    if old_status != new_status:
        # Check transition guard before allowing status change
        can_transition, reason = transition_service.can_transition_to(
            project, new_status, db
        )
        if not can_transition:
            raise HTTPException(
                status_code=422,
                detail=reason,
            )

        history = ProjectStatusHistory(
            project_id=project.id,
            from_status=old_status,
            to_status=new_status,
            changed_by=current_user.id,
        )
        db.add(history)
        logger.info(
            "Project %s status changed from '%s' to '%s' by user %s",
            project.id, old_status, new_status, current_user.id,
        )

        if new_status == "В производстве":
            stock_service.write_off_for_production(project_id, db)

    db.commit()
    db.refresh(project)
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) updated project {project.id}")
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Delete a project (cascade deletes items).

    Access Control:
        - Owner: can delete any project
        - Manager: can only delete own projects (owner_id == user.id)
        - Warehouse: 403 Forbidden (no project access)

    Args:
        project_id: The project ID
        current_user: Authenticated user with owner or manager role
        db: Database session

    Raises:
        HTTPException 404: If project not found
        HTTPException 403: If user lacks ownership (manager only)
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    # Verify ownership (owner bypass, manager must own)
    require_ownership(project, current_user.id, current_user.role)

    db.delete(project)
    db.commit()
    logger.info(f"User {current_user.id} (role: {current_user.role.value}) deleted project {project.id}")
    return None
