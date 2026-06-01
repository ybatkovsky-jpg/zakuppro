"""
Health check endpoint for readiness probes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint that returns API and database status.
    Verifies database connectivity by executing a simple query.
    Returns 503 when database is unreachable.
    """
    try:
        # Execute simple query to verify database connectivity
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db_status": "ok"}
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "degraded",
                "db_status": "error",
                "detail": str(e)
            }
        )
