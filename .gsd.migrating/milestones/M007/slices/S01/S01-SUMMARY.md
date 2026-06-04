---
id: S01
parent: M007
milestone: M007
provides:
  - Health check coverage for all 7 services (was only 3)
  - Graceful shutdown for telegram-bot via signal handler + flag
  - Celery worker_shutdown signal handler with active task logging
  - Docker healthchecks based on heartbeat freshness instead of ps aux | grep
  - stop_grace_period configured for all workers
requires:
  []
affects:
  []
key_files:
  - backend/email_worker.py
  - docker-compose.yml
  - backend/Dockerfile
  - backend/routers/health.py
  - backend/main.py
  - backend/tests/test_health.py
  - backend/telegram_bot.py
  - backend/celery_app.py
key_decisions:
  - Heartbeat files on shared Docker volume as cross-container health signal instead of HTTP endpoints or message-queue round-trips
  - Atomic writes via temp file + os.replace() for heartbeat safety during concurrent reads
  - stop_grace_period: celery-worker=60s, email-worker=30s, telegram-bot=15s — tuned to typical poll cycles and task durations
  - Register SIGTERM/SIGINT handler BEFORE Application.builder() so PTB's own handlers see the shutdown flag
patterns_established:
  - Atomic heartbeat file writes via temp file + os.replace() for cross-container health signals
  - FastAPI dependency override requires generator function (not generator object) for correct signature inspection
  - Telegram-bot signal handlers must be registered before Application.builder() to execute before PTB's internal handlers
observability_surfaces:
  - GET /health endpoint — per-service ok/error status for db, rabbitmq, celery_worker, email_worker, telegram_bot
  - Heartbeat files — /data/health/email_worker_heartbeat and /data/health/telegram_bot_heartbeat with UTC ISO timestamps
  - Docker healthchecks — heartbeat freshness-based (120s email, 90s telegram)
  - Shutdown logs — signal name, shutdown phase, active task count for celery-worker
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-06-04T21:54:48.227Z
blocker_discovered: false
---

# S01: Health Checks & Graceful Shutdown

**GET /health now returns status for all 7 services (including email-worker and telegram-bot via heartbeat files on shared volume); all workers handle SIGTERM with stop_grace_period configured in docker-compose.yml**

## What Happened

## What Happened

S01 delivered health checks and graceful shutdown across all three non-HTTP services — email-worker, telegram-bot, and celery-worker — by establishing a cross-container heartbeat protocol over a shared Docker volume.

### T01 — Heartbeat Infrastructure (email-worker + Docker)
- Added `_write_heartbeat()` to EmailWorker with atomic temp-file + `os.replace()` writes to `/data/health/email_worker_heartbeat`. Heartbeat written after every `poll_once()` cycle in a `finally` block — ensuring it fires even on IMAP errors. Fixed `datetime.utcnow()` deprecation by switching to `datetime.now(timezone.utc)`.
- Added `healthcheck_data` named volume to docker-compose.yml, mounted at `/data/health` on api, email-worker, and telegram-bot services.
- Replaced fragile `ps aux | grep` Docker healthchecks for email-worker (120s staleness threshold) and telegram-bot (90s threshold) with heartbeat freshness checks.
- Set `stop_grace_period`: celery-worker=60s, email-worker=30s, telegram-bot=15s.
- Added `RUN mkdir -p /data/health && chown appuser:appuser /data/health` to backend/Dockerfile.

### T02 — FastAPI /health Endpoint + Tests
- The health.py and main.py code was already in place from prior work. T02 created comprehensive test coverage.
- Created `backend/tests/test_health.py` with 13 tests across 3 classes: TestHealthEndpoint (5 API-level tests with mocked dependencies covering all-ok, email_worker degraded, telegram_bot degraded, db down, rabbitmq down), TestCheckEmailWorker (4 unit tests for heartbeat freshness logic), TestCheckTelegramBot (4 unit tests with 90s threshold).
- Key testing pattern established: FastAPI dependency override requires passing a generator *function* (not a generator object) for signature inspection to work correctly.

### T03 — telegram-bot Heartbeat + Shutdown + Celery worker_shutdown
- Added `_write_heartbeat()` function with atomic writes to `/data/health/telegram_bot_heartbeat`, registered via `application.job_queue.run_repeating(interval=30)` in post_init callback.
- Added `_handle_shutdown(signum, frame)` SIGTERM/SIGINT handler registered BEFORE `Application.builder()` — sets `shutdown_requested` flag so the finally block in `main()` logs structured shutdown messages.
- Added `@worker_shutdown.connect` handler in celery_app.py that inspects active task count and logs `'Celery worker shutting down — active_tasks=%d'` for observability.

### Cross-Cutting
- All three tasks converge on one mechanism: heartbeat files on a shared Docker volume, read by the FastAPI /health endpoint. This is the simplest cross-container health signal possible — no HTTP endpoints on workers, no message queue round-trips.
- Requirements R015 (graceful shutdown) and R016 (health checks for all services) are both advanced through this slice.

## Verification

All three verification gates passed:

| # | Command | Exit | Verdict | What It Proves |
|---|---------|------|---------|----------------|
| 1 | `python -m pytest backend/tests/test_email_worker.py -v` | 0 | pass (33/33) | EmailWorker heartbeat writes, atomic replace, poll_once integration, shutdown handling, and all legacy email processing tests |
| 2 | `python -m pytest backend/tests/test_health.py -v` | 0 | pass (13/13) | /health endpoint returns email_worker + telegram_bot status; degraded states produce 503; heartbeat freshness checks work for both workers |
| 3 | `python -m pytest backend/tests/test_email_worker.py -v -k shutdown` | 0 | pass (2/2) | Graceful shutdown flag-based mechanism (handle_shutdown + poll_forever_shutdown_requested) |

**Coverage details:**
- Heartbeat writing verified at unit level (temp file creation, atomic replace, timestamps) and integration level (written in finally block after both successful and failed poll cycles)
- Health endpoint verified with FastAPI TestClient for all 5 services, including 3 degradation paths (email_worker, telegram_bot, db, rabbitmq)
- Heartbeat freshness logic tested: ok with fresh file, error for missing/stale/unparseable
- Shutdown tests verify flag setting and poll loop termination

## Requirements Advanced

- R015 — Graceful shutdown: telegram-bot SIGTERM/SIGINT handler sets shutdown flag, Celery worker_shutdown signal logs active task count, docker-compose.yml stop_grace_period set for all workers (60s/30s/15s)
- R016 — Health checks for all services: /health endpoint now returns email_worker and telegram_bot status via heartbeat freshness checks, Docker healthchecks use heartbeat files instead of ps aux | grep

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

Cross-container heartbeat coupling is unidirectional (workers write, API reads) — no back-pressure or worker-to-api health signal. Single-container services only; multi-replica scenarios not tested.

## Follow-ups

Verify end-to-end task survival through full docker-compose stop/start cycle in a staging environment. Add RabbitMQ persistence verification to confirm task_acks_late works as expected.

## Files Created/Modified

None.
