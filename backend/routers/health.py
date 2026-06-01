"""
Health check endpoint for readiness probes.

Aggregates status of all system services:
- PostgreSQL database
- RabbitMQ message broker
- Celery worker
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from sqlalchemy.orm import Session
import logging

from backend.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])


def check_celery_worker() -> str:
    """
    Check Celery worker availability using inspect.ping().

    Returns 'ok' if at least one worker responds, 'error' otherwise.
    """
    try:
        from backend.celery_app import app
        inspect = app.control.inspect(timeout=2.0)
        stats = inspect.ping()

        if stats and len(stats) > 0:
            worker_count = len(stats)
            logger.info(f"Celery health check: {worker_count} worker(s) available")
            return 'ok'
        else:
            logger.warning("Celery health check: No workers responding")
            return 'error'
    except Exception as e:
        logger.error(f"Celery health check failed: {e}")
        return 'error'


def check_rabbitmq() -> str:
    """
    Check RabbitMQ connectivity via Celery broker connection.

    Returns 'ok' if connection succeeds, 'error' otherwise.
    """
    try:
        from backend.celery_app import app
        # Try to connect to broker
        with app.connection_or_acquire() as conn:
            conn.connect()
            logger.info("RabbitMQ health check: Connection successful")
            return 'ok'
    except Exception as e:
        logger.error(f"RabbitMQ health check failed: {e}")
        return 'error'


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint that returns status of all system services.

    Verifies:
    - Database connectivity
    - RabbitMQ broker availability
    - Celery worker readiness

    Returns 503 when any critical service is unreachable.
    """
    # Check database
    db_status = 'error'
    try:
        db.execute(text("SELECT 1"))
        db_status = 'ok'
    except SQLAlchemyError as e:
        logger.error(f"Database health check failed: {e}")

    # Check RabbitMQ
    rabbitmq_status = check_rabbitmq()

    # Check Celery worker
    celery_worker_status = check_celery_worker()

    # Aggregate overall status
    all_ok = all(status == 'ok' for status in [db_status, rabbitmq_status, celery_worker_status])

    if all_ok:
        return {
            "status": "ok",
            "db": db_status,
            "rabbitmq": rabbitmq_status,
            "celery_worker": celery_worker_status
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "degraded",
                "db": db_status,
                "rabbitmq": rabbitmq_status,
                "celery_worker": celery_worker_status
            }
        )
