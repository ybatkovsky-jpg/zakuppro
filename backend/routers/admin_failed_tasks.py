"""
Admin router for Dead Letter Queue (DLQ) management — FailedTask endpoints.

Provides endpoints for viewing and retrying failed Celery tasks.
Access is restricted to OWNER role only.

Endpoints:
    GET  /api/admin/failed-tasks/      — paginated list with optional task_name filter
    GET  /api/admin/failed-tasks/{id}  — detail by primary key
    POST /api/admin/failed-tasks/{id}/retry — re-dispatch a failed task to Celery
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.celery_app import app as celery_app
from backend.database import get_db
from backend.models import FailedTask, User, Role
from backend.rbac import require_role
from backend.schemas import FailedTaskListResponse, FailedTaskResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/failed-tasks", tags=["admin"])


# =============================================================================
# List — paginated with optional task_name filter
# =============================================================================

@router.get("/", response_model=FailedTaskListResponse)
def list_failed_tasks(
    skip: int = Query(0, ge=0, description="Number of records to skip for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    task_name: Optional[str] = Query(None, description="Filter by Celery task name (exact match)"),
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db),
):
    """
    List failed tasks with pagination and optional task_name filter.

    Access Control:
        - Owner: full access
        - Manager: 403 Forbidden
        - Warehouse: 403 Forbidden

    Results are ordered by created_at descending (most recent first).
    """
    logger.info(
        "list_failed_tasks called: skip=%s, limit=%s, task_name=%s, user=%s",
        skip, limit, task_name, current_user.id,
    )

    query = db.query(FailedTask)

    if task_name:
        query = query.filter(FailedTask.task_name == task_name)
        logger.debug("Applied task_name filter: %s", task_name)

    total = query.count()
    items = (
        query.order_by(FailedTask.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    logger.info("Returning %d of %d failed tasks", len(items), total)
    return FailedTaskListResponse(items=items, total=total, skip=skip, limit=limit)


# =============================================================================
# Detail — single record by primary key
# =============================================================================

@router.get("/{failed_task_id}", response_model=FailedTaskResponse)
def get_failed_task(
    failed_task_id: int,
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db),
):
    """
    Get a single failed task by its primary key.

    Access Control:
        - Owner: full access
        - Manager: 403 Forbidden
        - Warehouse: 403 Forbidden

    Returns 404 if the record does not exist.
    """
    logger.info(
        "get_failed_task called: id=%s, user=%s",
        failed_task_id, current_user.id,
    )

    task = db.query(FailedTask).filter(FailedTask.id == failed_task_id).first()
    if not task:
        logger.warning("FailedTask with id %s not found", failed_task_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"FailedTask with id {failed_task_id} not found",
        )
    return task


# =============================================================================
# Retry — re-dispatch a failed task to Celery
# =============================================================================

@router.post("/{failed_task_id}/retry")
def retry_failed_task(
    failed_task_id: int,
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db),
):
    """
    Retry a failed task by re-dispatching it to Celery.

    Access Control:
        - Owner: can retry
        - Manager: 403 Forbidden
        - Warehouse: 403 Forbidden

    Flow:
    1. Load the FailedTask record (404 if missing).
    2. Validate that the task_name is registered in Celery (400 if unknown).
    3. Deserialize the context JSON (422 if malformed).
    4. Call apply_async(kwargs=context_dict) on the resolved task.
    5. Delete the FailedTask record on success.

    Returns {"status": "retried"} on success.
    """
    logger.info(
        "retry_failed_task called: id=%s, user=%s",
        failed_task_id, current_user.id,
    )

    failed_task = db.query(FailedTask).filter(FailedTask.id == failed_task_id).first()
    if not failed_task:
        logger.warning("FailedTask with id %s not found for retry", failed_task_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"FailedTask with id {failed_task_id} not found",
        )

    # Step 2: validate task_name is registered in Celery
    if failed_task.task_name not in celery_app.tasks:
        logger.warning(
            "Task '%s' is not registered in Celery (FailedTask %s)",
            failed_task.task_name, failed_task_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task '{failed_task.task_name}' is not registered in Celery",
        )

    # Step 3: deserialize context JSON
    context_dict: dict = {}
    if failed_task.context:
        try:
            context_dict = json.loads(failed_task.context)
        except json.JSONDecodeError as exc:
            logger.warning(
                "Malformed context JSON for FailedTask %s: %s",
                failed_task_id, exc,
            )
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed task context is malformed JSON: {failed_task.context}",
            )

    # Step 4: resolve task and dispatch
    task_func = celery_app.tasks[failed_task.task_name]
    task_func.apply_async(kwargs=context_dict)
    logger.info(
        "Dispatched %s with context=%s (FailedTask %s)",
        failed_task.task_name, context_dict, failed_task_id,
    )

    # Step 5: delete the FailedTask record on success
    db.delete(failed_task)
    db.commit()

    logger.info(
        "User %s (role=%s) retried FailedTask %s (%s) — record deleted",
        current_user.id, current_user.role.value, failed_task_id, failed_task.task_name,
    )

    return {"status": "retried"}
