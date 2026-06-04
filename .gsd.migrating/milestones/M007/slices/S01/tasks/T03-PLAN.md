---
estimated_steps: 16
estimated_files: 2
skills_used: []
---

# T03: Add heartbeat + graceful shutdown to telegram-bot + Celery worker_shutdown signal

Why: telegram-bot has no heartbeat mechanism (needed by T02) and no SIGTERM/SIGINT handling for graceful Docker shutdown. Celery worker lacks a worker_shutdown signal handler for logging active task state during shutdown.

Do:
1. In telegram_bot.py:
   a. Add `import signal` and `from pathlib import Path` (already imported).
   b. Add a `shutdown_requested = False` module-level flag.
   c. Write a `_write_heartbeat()` function: writes UTC timestamp ISO string to /data/health/telegram_bot_heartbeat atomically (temp file + os.replace). Uses Path.mkdir for parent dirs.
   d. Write a `_handle_shutdown(signum, frame)` function: logs signal name, sets shutdown_requested=True.
   e. Register SIGTERM/SIGINT handlers BEFORE building the Application: `signal.signal(signal.SIGTERM, _handle_shutdown); signal.signal(signal.SIGINT, _handle_shutdown)`.
   f. Use `application.job_queue.run_repeating(_write_heartbeat, interval=30, first=5)` to write heartbeat every 30s. Register this in a `post_init` callback via `application.post_init`.
   g. After run_polling() returns (blocking call ends when application.stop() is called or error), check shutdown_requested and log 'Telegram bot shutdown complete'.
   IMPORTANT: python-telegram-bot's run_polling() internally handles SIGINT/SIGTERM by calling application.stop(). Our signal handlers run first (setting the flag) then PTB's handler calls stop(). This is safe — we just need our flag for logging.

2. In celery_app.py:
   a. Import `from celery.signals import worker_shutdown`.
   b. Add a `@worker_shutdown.connect` handler that logs 'Celery worker shutting down' and the number of active tasks (if available via app.control.inspect().active() or similar). Log as structured info.
   c. Keep task_acks_late=True (already set) — this ensures unacknowledged tasks are re-delivered on restart.

Done when: telegram_bot.py writes heartbeat every 30s and handles SIGTERM; celery_app.py has worker_shutdown signal handler; existing tests pass.

## Inputs

- `backend/telegram_bot.py`
- `backend/celery_app.py`

## Expected Output

- `backend/telegram_bot.py`
- `backend/celery_app.py`

## Verification

python -m pytest backend/tests/test_email_worker.py -v -k shutdown
