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
from backend.status_map import map_project_status, map_item_status, map_project_status_to_ru
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
    # Map Russian statuses to English for frontend compatibility
    for p in projects:
        if hasattr(p, 'status') and p.status:
            p.status = map_project_status(p.status)
