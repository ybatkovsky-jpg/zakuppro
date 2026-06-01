"""
Project CRUD router for ZakupPro API.
Provides endpoints for managing projects and their items.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Project
from backend.schemas import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectResponse])
def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all projects with pagination.

    Args:
        skip: Number of records to skip (for pagination)
        limit: Maximum number of records to return
        db: Database session

    Returns:
        List of projects without eager-loaded relationships
    """
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """
    Get a single project by ID with eager-loaded items.

    Args:
        project_id: The project ID
        db: Database session

    Returns:
        Project with items array

    Raises:
        HTTPException 404: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    return project


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project_data: ProjectCreate, db: Session = Depends(get_db)):
    """
    Create a new project.

    Args:
        project_data: Project creation data
        db: Database session

    Returns:
        Created project with assigned id
    """
    new_project = Project(**project_data.model_dump())
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project_data: ProjectUpdate, db: Session = Depends(get_db)):
    """
    Update an existing project.

    Args:
        project_id: The project ID
        project_data: Project update data (partial)
        db: Database session

    Returns:
        Updated project

    Raises:
        HTTPException 404: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    update_data = project_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """
    Delete a project (cascade deletes items).

    Args:
        project_id: The project ID
        db: Database session

    Raises:
        HTTPException 404: If project not found
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    db.delete(project)
    db.commit()
