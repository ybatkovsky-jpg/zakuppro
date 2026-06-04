---
estimated_steps: 11
estimated_files: 3
skills_used: []
---

# T02: Extend FastAPI /health endpoint + lifespan + tests

Why: The /health endpoint only checks db, rabbitmq, and celery_worker. R016 requires health checks for all services including email-worker and telegram-bot. Adding a lifespan context manager provides a hook for future shutdown cleanup (connection pools, etc.).

Do:
1. In health.py: Add check_email_worker() function that reads /data/health/email_worker_heartbeat, parses UTC timestamp, returns 'ok' if < 120s old, 'error' otherwise (or if file missing/unparseable). Add check_telegram_bot() with 90s threshold. Include both in the /health response dict and the all_ok aggregate.
2. In main.py: Add a lifespan async context manager (@app.lifespan) that logs startup/shutdown. On shutdown, log 'FastAPI shutting down' — this is a placeholder for future cleanup (DB connection pools, etc.). Replace the direct app creation with the lifespan-managed app.
3. In test_health.py (NEW): Write pytest tests:
   - test_health_all_ok: mock db, rabbitmq, celery, and heartbeat files → assert 200
   - test_health_email_worker_degraded: missing heartbeat file → assert 'error' in response
   - test_health_telegram_bot_degraded: stale heartbeat → assert 'error'
   - test_health_db_down: mock DB failure → assert 503
   - test_health_rabbitmq_down: mock rabbitmq failure → assert 503

Done when: python -m pytest backend/tests/test_health.py -v passes all tests; /health response includes email_worker and telegram_bot fields.

## Inputs

- `backend/routers/health.py`
- `backend/main.py`
- `backend/email_worker.py`
- `backend/telegram_bot.py`

## Expected Output

- `backend/routers/health.py`
- `backend/main.py`
- `backend/tests/test_health.py`

## Verification

python -m pytest backend/tests/test_health.py -v
