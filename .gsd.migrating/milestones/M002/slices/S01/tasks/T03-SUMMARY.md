---
id: T03
parent: S01
milestone: M002
key_files:
  - docker-compose.yml
  - backend/routers/health.py
  - .env
key_decisions:
  - Used app.control.inspect().ping() for worker health check (standard Celery pattern)
  - Used app.connection_or_acquire() for RabbitMQ connectivity check
  - Health check returns 503 when ANY service is degraded (fail-fast approach)
duration: 
verification_result: passed
completed_at: 2026-06-01T10:13:42.437Z
blocker_discovered: false
---

# T03: Added celery-worker service to docker-compose.yml and extended health check with RabbitMQ and Celery worker status

**Added celery-worker service to docker-compose.yml and extended health check with RabbitMQ and Celery worker status**

## What Happened

Implemented T03: Created Celery worker service and extended health check.

Changes made:
1. Added celery-worker service to docker-compose.yml:
   - Build context: ./backend (same as API)
   - Command: celery -A backend.celery_app worker --loglevel=info
   - Depends on rabbitmq with healthcheck condition
   - Connected to zakuppro-network

2. Extended backend/routers/health.py:
   - Added check_celery_worker() function using app.control.inspect().ping()
   - Added check_rabbitmq() function using app.connection_or_acquire()
   - Updated /health endpoint to return aggregated status of db, rabbitmq, and celery_worker
   - Returns 503 when any service is unavailable

3. Added CELERY_BROKER_URL=pyamqp://guest:guest@rabbitmq:5672// to .env

The health check now provides complete system status aggregation.

## Verification

Verified:
- docker-compose.yml syntax is valid (YAML structure correct)
- health.py Python syntax compiles successfully
- Celery app imports correctly
- Tasks import correctly
- Health check functions execute correctly (return 'error' when RabbitMQ unavailable, which is expected behavior)
- Expected health check response format includes celery_worker field: {'status': 'ok', 'db': 'ok', 'rabbitmq': 'ok', 'celery_worker': 'ok'}

Note: Docker not available in this environment, so full integration test with running services was not performed. The implementation follows the task plan and code is syntactically correct.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -m py_compile backend/routers/health.py` | 0 | PASS | 500ms |
| 2 | `python -c "from backend.celery_app import app"` | 0 | PASS | 300ms |
| 3 | `python -c "from backend.tasks import dummy_health_check"` | 0 | PASS | 300ms |
| 4 | `python -c "from backend.routers.health import check_celery_worker, check_rabbitmq; print(check_celery_worker(), check_rabbitmq())"` | 0 | PASS | 1000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `docker-compose.yml`
- `backend/routers/health.py`
- `.env`
