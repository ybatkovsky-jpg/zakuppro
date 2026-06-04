# Slice S01 Research: Health Checks & Graceful Shutdown

## Summary

Seven services are defined in `docker-compose.yml`: PostgreSQL, FastAPI (api), RabbitMQ, email-worker, celery-worker, telegram-bot, and Next.js (frontend). The FastAPI service already has a `/health` endpoint in `routers/health.py` that checks DB, RabbitMQ, and Celery worker, but it does not cover the email-worker or telegram-bot services. Those two services currently use crude `ps aux` Docker healthchecks. For graceful shutdown, only the email-worker has explicit signal handling (SIGTERM/SIGINT). The Celery worker relies on Celery's built-in shutdown, but no `stop_grace_period` is configured in `docker-compose.yml`, risking in-flight task loss during container stop.

## Requirements Coverage

- **R015 (Graceful shutdown and cleanup):** Partially met. Email-worker has complete SIGTERM/SIGINT handling. Celery worker has `task_acks_late=True` for reliability but no explicit `stop_grace_period`. Telegram bot has no signal handling. FastAPI/Uvicorn handles signals natively but has no `on_shutdown` event for cleanup. Docker Compose has no `stop_grace_period` set anywhere (defaults to 10s).

- **R016 (Health check endpoints):** Partially met. FastAPI has a `/health` endpoint checking DB, RabbitMQ, and Celery worker. Missing: email-worker and telegram-bot health status. Those two services only have `ps aux` Docker-level probes.

## Implementation Landscape

### Files to Touch

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Add `stop_grace_period` to celery-worker, email-worker; improve email-worker and telegram-bot healthchecks |
| `backend/routers/health.py` | Add email-worker and telegram-bot status checks to `/health` |
| `backend/main.py` | Add FastAPI lifespan/on_shutdown event for graceful cleanup |
| `backend/celery_app.py` | Add `worker_shutdown` signal handler for logging/graceful task drain |
| `backend/telegram_bot.py` | Add SIGTERM/SIGINT signal handlers for graceful stop |
| `backend/email_worker.py` | Add lightweight health check mechanism (file-based heartbeat) |
| `backend/Dockerfile` | Update HEALTHCHECK for api if needed |
| `backend/tasks.py` | Already has `dummy_health_check` task; no changes needed |

### Natural Seams

1. **FastAPI health endpoint enhancement** -- Add email-worker and telegram-bot health probes to `routers/health.py`. These can be file-based (worker writes a timestamp to a known file; health endpoint checks freshness) since the workers are not HTTP services.

2. **Docker Compose stop_grace_period** -- Edit `docker-compose.yml` to add `stop_grace_period: 30s` to celery-worker (allows in-flight tasks to finish) and `stop_grace_period: 15s` to email-worker.

3. **Telegram bot graceful shutdown** -- Add `signal.signal(signal.SIGTERM, handler)` and `signal.signal(signal.SIGINT, handler)` to `telegram_bot.py`, mirroring email_worker's pattern. Signal handler sets a shutdown flag; main loop checks it and calls `application.stop()`.

4. **Celery worker_shutdown signal** -- Add a `worker_shutdown` signal handler in `celery_app.py` that logs active tasks before shutdown.

5. **Infrastructure healthcheck improvement** -- Replace `ps aux` Docker healthchecks for email-worker and telegram-bot with more reliable probes:
   - email-worker: write a heartbeat timestamp file; healthcheck checks file freshness with `test $(($(date +%s) - $(stat -c %Y /tmp/email_worker_heartbeat))) -lt 120`
   - telegram-bot: same heartbeat file approach

### First Proof

The **highest risk item** is ensuring the Celery worker does not lose in-flight tasks during `docker-compose stop`. With `task_acks_late=True`, Celery already re-delivers unacknowledged tasks on restart, but the default 10s `stop_grace_period` may be too short for long-running LLM tasks (tasks have `soft_time_limit=25m`, `time_limit=30m`). Verify first: set `stop_grace_period: 60s` for celery-worker, then run `docker-compose stop` while a task is running and confirm the task completes and result is stored.

## Key Findings

### What Exists

**FastAPI `/health` endpoint** (`routers/health.py`):
- Checks PostgreSQL via `SELECT 1`
- Checks RabbitMQ via `app.connection_or_acquire().connect()`
- Checks Celery worker via `app.control.inspect().ping()` with 2s timeout
- Returns 200 (all ok) or 503 (any degraded)
- Registered in `main.py` at `GET /health` (no prefix)

**Docker-level healthchecks in docker-compose.yml:**
| Service | Probe | Type |
|---------|-------|------|
| db | `pg_isready -U postgres -d zakuppro` | Native |
| api | `python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"` | HTTP via Python |
| rabbitmq | `rabbitmq-diagnostics -q ping` | Native |
| email-worker | `ps aux \| grep email_worker \| grep -v grep \|\| exit 1` | Proc check |
| celery-worker | `celery -A backend.celery_app inspect ping --timeout=2 \|\| exit 1` | Celery ping |
| telegram-bot | `ps aux \| grep telegram_bot \| grep -v grep \|\| exit 1` | Proc check |
| frontend | `curl -f http://localhost:3000/` | HTTP |

**Graceful shutdown:**
- **email-worker** (`backend/email_worker.py`): Full implementation -- `signal.signal(SIGTERM, handler)`, `shutdown_requested` flag, break-out-of-loop logic, final stats print. Tests exist in `test_email_worker.py`.
- **celery-worker**: Built-in Celery SIGTERM handling. `task_acks_late=True` prevents task loss. No custom `worker_shutdown` signal.
- **telegram-bot** (`backend/telegram_bot.py`): No signal handling. `application.run_polling()` has internal signal handling but no custom cleanup. No shutdown flag.
- **api (FastAPI)**: Uvicorn handles SIGTERM natively. No `on_shutdown` or lifespan events configured.
- **frontend (Node.js)**: Built-in signal handling.

### What's Missing

1. **FastAPI `/health` does not include email-worker or telegram-bot.** Both non-HTTP services need a mechanism to report health. Recommended approach: heartbeat files.

2. **No `stop_grace_period` configured.** Docker defaults to 10s. Celery tasks can run up to 30 minutes. Email-worker polls at 60s intervals. Both need longer grace periods.

3. **Telegram bot has no shutdown handler.** If Docker sends SIGTERM, `application.run_polling()` is not guaranteed to clean up gracefully.

4. **Celery worker lacks `worker_shutdown` signal.** No custom logging or metrics on shutdown.

5. **No health endpoint tests.** `routers/health.py` has no corresponding test file.

6. **FastAPI has no lifecycle hooks.** No `startup`/`shutdown` events or lifespan context manager for resource cleanup.

### Constraints

- **email-worker and telegram-bot are not HTTP services.** They cannot serve HTTP health endpoints without adding a web server dependency. Heartbeat files are the lightest approach.
- **The email-worker uses `signal.signal()` in the main thread already**, so the signal registration pattern is proven.
- **The telegram-bot uses `asyncio`** (python-telegram-bot is async), so signal handlers must coordinate with the event loop.
- **Celery time limits** are configured at `soft=25m, hard=30m`. Stopping the container must allow at least 30s+ for task cleanup.
- **The `restart: unless-stopped` policy** on email-worker and telegram-bot means Docker will restart them if they exit unexpectedly.

## Recommendation

1. **Implement heartbeat-file health for email-worker and telegram-bot.** Each worker writes a timestamp to `/tmp/<service>_heartbeat` every poll/update cycle. The FastAPI `/health` endpoint reads these files and checks freshness (< 2x poll interval). This avoids adding HTTP dependencies to non-HTTP services.

2. **Add `stop_grace_period` to docker-compose.yml:**
   - `celery-worker: stop_grace_period: 60s` -- allows in-flight LLM tasks to finish
   - `email-worker: stop_grace_period: 30s` -- allows current poll iteration to finish
   - `telegram-bot: stop_grace_period: 15s` -- allows current handler to finish

3. **Add SIGTERM/SIGINT handling to `telegram_bot.py`** using `signal.signal()`. Pattern: set `shutdown_requested = True`, `application.stop()` in the handler. Since `run_polling()` is blocking, the signal handler should set a flag and the main can call `application.stop()` after `run_polling()` returns.

4. **Add `worker_shutdown` signal to `celery_app.py`** for logging and metrics. This is a one-liner using Celery's `@app.on_after_finalize.connect` or `WorkerShutdown` signal.

5. **Update FastAPI `main.py`** to add a lifespan context manager for future cleanup needs (connection pools, etc.).

6. **Replace `ps aux` Docker healthchecks** for email-worker and telegram-bot with heartbeat freshness checks or process checks. Since heartbeat files need the FastAPI `/health` endpoint to exist first, this is dependent on item 1.

## Verification

```bash
# 1. FastAPI /health endpoint returns 200 with all services ok
curl -f http://localhost:8000/health

# 2. FastAPI /health returns 503 when a service is down
docker stop zakuppro-celery-worker
curl -f http://localhost:8000/health  # expect exit code 22 (HTTP 503)

# 3. Graceful shutdown - no tasks lost
docker-compose stop celery-worker --timeout 60
docker logs zakuppro-celery-worker  # should show cleanup log messages

# 4. Graceful shutdown - telegram bot stops cleanly
docker-compose stop telegram-bot --timeout 15
docker logs zakuppro-telegram-bot  # should show "shutdown complete"

# 5. Docker healthcheck improvements - email worker heartbeat
docker exec zakuppro-email-worker test -f /tmp/email_worker_heartbeat && echo "OK"

# 6. Run existing health route tests
python -m pytest backend/tests/test_email_worker.py -v -k "shutdown"

# 7. Full integration - start stack, verify all healthchecks pass
docker-compose up -d
docker-compose ps  # all services should show "healthy"
```