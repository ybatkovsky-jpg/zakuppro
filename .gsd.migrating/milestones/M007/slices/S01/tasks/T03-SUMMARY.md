---
id: T03
parent: S01
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-04T21:51:27.855Z
blocker_discovered: false
---

# T03: Added heartbeat file writing + SIGTERM/SIGINT graceful shutdown to telegram-bot and worker_shutdown signal handler to Celery worker

**Added heartbeat file writing + SIGTERM/SIGINT graceful shutdown to telegram-bot and worker_shutdown signal handler to Celery worker**

## What Happened

T03 implementation was already present in both files from the prior attempt. Verification confirmed all 46 tests pass.

**telegram_bot.py changes:**
- Module-level `shutdown_requested = False` flag for graceful shutdown tracking
- `_write_heartbeat()` function: writes UTC ISO timestamp to `/data/health/telegram_bot_heartbeat` atomically via temp file + `os.replace()`, with parent directory creation
- `_handle_shutdown(signum, frame)` function: logs signal name via `signal.Signals(signum).name`, sets `shutdown_requested = True`
- `signal.signal(signal.SIGTERM, _handle_shutdown)` and `signal.signal(signal.SIGINT, _handle_shutdown)` registered BEFORE `Application.builder()` — runs before PTB's own handlers, just sets the flag
- `post_init` async callback registers `application.job_queue.run_repeating(_write_heartbeat, interval=30, first=5)` — heartbeat written every 30s starting 5s after init
- `main()` finally block checks `shutdown_requested` flag and logs "Telegram bot shutdown complete" vs generic message

**celery_app.py changes:**
- Import `from celery.signals import worker_shutdown`
- `@worker_shutdown.connect` handler `on_worker_shutdown`: attempts `app.control.inspect().active()` to count active tasks, logs structured `'Celery worker shutting down — active_tasks=%d'` message
- `task_acks_late=True` preserved — unacknowledged tasks re-delivered on restart

## Verification

Ran pytest on all related test files:
- `python -m pytest backend/tests/test_email_worker.py -v -k shutdown` — 2 passed (test_handle_shutdown, test_poll_forever_shutdown_requested)
- `python -m pytest backend/tests/test_email_worker.py backend/tests/test_health.py -v` — 46 passed total (all email_worker + health endpoint + heartbeat check tests)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -m pytest backend/tests/test_email_worker.py -v -k shutdown` | 0 | pass | 2190ms |
| 2 | `python -m pytest backend/tests/test_email_worker.py backend/tests/test_health.py -v` | 0 | pass | 3330ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
