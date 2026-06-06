"""
Health check endpoint for readiness probes.

Aggregates status of all system services:
- PostgreSQL database (required for health)
- RabbitMQ message broker (optional — warns if unavailable)
- Celery worker (optional — warns if unavailable)
- Email worker (optional — heartbeat file)
- Telegram bot (optional — heartbeat file)

The /health endpoint returns 200 if the database is reachable,
even if optional services are degraded. This ensures the API container
is marked healthy by Docker as long as it can serve requests.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime, timezone
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


def check_email_worker(
    heartbeat_file: str = '/data/health/email_worker_heartbeat',
    max_age: int = 120,
) -> str:
    """
    Check email worker health by reading its heartbeat file.

    Returns 'ok' if the heartbeat timestamp is within max_age seconds,
    'error' if the file is missing, unparseable, or stale.
    """
    try:
        timestamp_str = Path(heartbeat_file).read_text().strip()
        heartbeat_time = datetime.fromisoformat(timestamp_str)
        age = (datetime.now(timezone.utc) - heartbeat_time).total_seconds()
        if age < max_age:
            logger.info(f"Email worker health check: ok (heartbeat {age:.0f}s old)")
            return 'ok'
        else:
            logger.warning(f"Email worker heartbeat is stale: {age:.0f}s old (max {max_age}s)")
            return 'error'
    except FileNotFoundError:
        logger.warning(f"Email worker heartbeat file not found: {heartbeat_file}")
        return 'error'
    except (ValueError, OSError) as e:
        logger.error(f"Email worker heartbeat unparseable: {e}")
        return 'error'


def check_telegram_bot(
    heartbeat_file: str = '/data/health/telegram_bot_heartbeat',
    max_age: int = 90,
) -> str:
    """
    Check telegram bot health by reading its heartbeat file.

    Returns 'ok' if the heartbeat timestamp is within max_age seconds,
    'error' if the file is missing, unparseable, or stale.
    """
    try:
        timestamp_str = Path(heartbeat_file).read_text().strip()
        heartbeat_time = datetime.fromisoformat(timestamp_str)
        age = (datetime.now(timezone.utc) - heartbeat_time).total_seconds()
        if age < max_age:
            logger.info(f"Telegram bot health check: ok (heartbeat {age:.0f}s old)")
            return 'ok'
        else:
            logger.warning(f"Telegram bot heartbeat is stale: {age:.0f}s old (max {max_age}s)")
            return 'error'
    except FileNotFoundError:
        logger.warning(f"Telegram bot heartbeat file not found: {heartbeat_file}")
        return 'error'
    except (ValueError, OSError) as e:
        logger.error(f"Telegram bot heartbeat unparseable: {e}")
        return 'error'


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint that returns status of all system services.

    Returns 200 if the database is reachable (core service).
    Optional services (RabbitMQ, Celery, email worker, telegram bot)
    are reported but do not cause a 503 — they may be intentionally
    disabled when their API keys are not configured.

    For strict readiness (all services required), use /health/ready.
    """
    # Check database (required)
    db_status = 'error'
    try:
        db.execute(text("SELECT 1"))
        db_status = 'ok'
    except SQLAlchemyError as e:
        logger.error(f"Database health check failed: {e}")

    # Check optional services
    rabbitmq_status = check_rabbitmq()
    celery_worker_status = check_celery_worker()
    email_worker_status = check_email_worker()
    telegram_bot_status = check_telegram_bot()

    # Core health: database must be reachable
    if db_status != 'ok':
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "db": db_status,
                "rabbitmq": rabbitmq_status,
                "celery_worker": celery_worker_status,
                "email_worker": email_worker_status,
                "telegram_bot": telegram_bot_status,
            }
        )

    return {
        "status": "ok",
        "db": db_status,
        "rabbitmq": rabbitmq_status,
        "celery_worker": celery_worker_status,
        "email_worker": email_worker_status,
        "telegram_bot": telegram_bot_status,
    }


@router.get("/health/ready")
async def readiness_check(db: Session = Depends(get_db)):
    """
    Strict readiness check: ALL services must be healthy.
    Returns 503 when any service is unreachable.
    """
    # Check database
    db_status = 'error'
    try:
        db.execute(text("SELECT 1"))
        db_status = 'ok'
    except SQLAlchemyError as e:
        logger.error(f"Database health check failed: {e}")

    # Check all services
    rabbitmq_status = check_rabbitmq()
    celery_worker_status = check_celery_worker()
    email_worker_status = check_email_worker()
    telegram_bot_status = check_telegram_bot()

    # All must be ok
    all_ok = all(
        status == 'ok' for status in [
            db_status,
            rabbitmq_status,
            celery_worker_status,
            email_worker_status,
            telegram_bot_status,
        ]
    )

    if all_ok:
        return {
            "status": "ok",
            "db": db_status,
            "rabbitmq": rabbitmq_status,
            "celery_worker": celery_worker_status,
            "email_worker": email_worker_status,
            "telegram_bot": telegram_bot_status,
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "degraded",
                "db": db_status,
                "rabbitmq": rabbitmq_status,
                "celery_worker": celery_worker_status,
                "email_worker": email_worker_status,
                "telegram_bot": telegram_bot_status,
            }
        )
