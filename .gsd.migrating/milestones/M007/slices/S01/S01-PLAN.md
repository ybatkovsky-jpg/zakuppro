# S01: Health Checks & Graceful Shutdown

**Goal:** GET /health returns status of all 7 services (including email-worker and telegram-bot). docker-compose stop completes without task loss — all workers handle SIGTERM, drain in-flight work, and exit cleanly within their configured grace periods.
**Demo:** GET /health на каждом сервисе возвращает статус; docker-compose stop отрабатывает без потери задач

## Must-Haves

- FastAPI /health endpoint returns `email_worker` and `telegram_bot` status alongside existing db/rabbitmq/celery_worker checks
- email-worker writes heartbeat to shared volume every poll cycle; stale heartbeat (>120s) triggers degraded status
- telegram-bot writes heartbeat every 30s via job queue; stale heartbeat (>90s) triggers degraded status
- telegram-bot handles SIGTERM/SIGINT: sets shutdown flag, calls application.stop(), logs shutdown
- celery-worker logs active task count on worker_shutdown signal
- docker-compose.yml: stop_grace_period set to 60s (celery-worker), 30s (email-worker), 15s (telegram-bot)
- Docker healthchecks for email-worker and telegram-bot use heartbeat freshness instead of `ps aux | grep`
- No in-flight Celery tasks are lost during docker-compose stop (task_acks_late + adequate grace period)

## Proof Level

- This slice proves: operational

## Integration Closure

- Upstream surfaces consumed: backend/routers/health.py (existing /health endpoint), backend/email_worker.py (existing EmailWorker class), backend/telegram_bot.py (existing main + Application), backend/celery_app.py (existing Celery app), docker-compose.yml (existing service definitions)
- New wiring introduced: shared `healthcheck_data` volume mounted in api, email-worker, and telegram-bot containers; lifespan context manager in main.py for future shutdown hooks; heartbeat file writing in email-worker poll loop and telegram-bot job queue
- What remains before the milestone is truly usable end-to-end: S02 (retry with backoff), S03 (RBAC), S04 (DLQ admin UI) — health checks and graceful shutdown are independently deployable

## Verification

- Runtime signals: heartbeat file timestamps written every poll/update cycle; structured logs on signal receipt, shutdown phase transitions, and heartbeat staleness
- Inspection surfaces: GET /health returns per-service status (ok/error) with explicit service names; docker-compose ps shows container health status; docker logs show shutdown sequences
- Failure visibility: stale heartbeat detected by health endpoint → 503 with degraded detail; signal handler logs signal name and shutdown progress; healthcheck failures visible in docker-compose ps
- Redaction constraints: none — heartbeat files contain only UTC timestamps; health endpoint returns only ok/error status strings

## Tasks

- [x] **T01: Add heartbeat to email-worker + Docker infrastructure (volume, healthchecks, stop_grace_period)** `est:45m`
  Why: email-worker currently uses `ps aux | grep` for Docker healthcheck which is fragile. The FastAPI /health endpoint cannot check non-HTTP workers without a shared mechanism. Heartbeat files on a shared volume provide the lightest cross-container health signal.
  - Files: `backend/email_worker.py`, `docker-compose.yml`, `backend/Dockerfile`
  - Verify: python -m pytest backend/tests/test_email_worker.py -v

- [x] **T02: Extend FastAPI /health endpoint + lifespan + tests** `est:1h`
  Why: The /health endpoint only checks db, rabbitmq, and celery_worker. R016 requires health checks for all services including email-worker and telegram-bot. Adding a lifespan context manager provides a hook for future shutdown cleanup (connection pools, etc.).
  - Files: `backend/routers/health.py`, `backend/main.py`, `backend/tests/test_health.py`
  - Verify: python -m pytest backend/tests/test_health.py -v

- [x] **T03: Add heartbeat + graceful shutdown to telegram-bot + Celery worker_shutdown signal** `est:45m`
  Why: telegram-bot has no heartbeat mechanism (needed by T02) and no SIGTERM/SIGINT handling for graceful Docker shutdown. Celery worker lacks a worker_shutdown signal handler for logging active task state during shutdown.
  - Files: `backend/telegram_bot.py`, `backend/celery_app.py`
  - Verify: python -m pytest backend/tests/test_email_worker.py -v -k shutdown

## Files Likely Touched

- backend/email_worker.py
- docker-compose.yml
- backend/Dockerfile
- backend/routers/health.py
- backend/main.py
- backend/tests/test_health.py
- backend/telegram_bot.py
- backend/celery_app.py
