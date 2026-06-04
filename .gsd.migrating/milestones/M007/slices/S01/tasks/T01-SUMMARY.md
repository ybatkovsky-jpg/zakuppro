---
id: T01
parent: S01
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-04T12:38:48.557Z
blocker_discovered: false
---

# T01: Added heartbeat file writing to email-worker with atomic writes, Docker healthcheck volume/mounts, heartbeat-based healthchecks for email-worker and telegram-bot, stop_grace_period for all workers, and /data/health directory in Dockerfile

**Added heartbeat file writing to email-worker with atomic writes, Docker healthcheck volume/mounts, heartbeat-based healthchecks for email-worker and telegram-bot, stop_grace_period for all workers, and /data/health directory in Dockerfile**

## What Happened

Implemented three changes across email_worker.py, docker-compose.yml, and Dockerfile:

1. **email_worker.py**: Added `heartbeat_file` parameter (default `/data/health/email_worker_heartbeat`) to EmailWorker.__init__. New `_write_heartbeat()` method writes UTC timestamp atomically (temp file + os.replace) after each `poll_once()` iteration in a `finally` block — ensuring heartbeat is written even on errors. Heartbeat path is configurable via `EMAIL_WORKER_HEARTBEAT_FILE` env var. Fixed `datetime.utcnow()` deprecation by switching to `datetime.now(timezone.utc)`.

2. **docker-compose.yml**: Added `healthcheck_data` named volume. Mounted `healthcheck_data:/data/health` on api, email-worker, and telegram-bot services. Replaced fragile `ps aux | grep` healthchecks for email-worker and telegram-bot with heartbeat freshness checks (120s and 90s thresholds respectively). Added `stop_grace_period`: celery-worker=60s, email-worker=30s, telegram-bot=15s.

3. **Dockerfile**: Added `RUN mkdir -p /data/health && chown appuser:appuser /data/health` before the USER switch, ensuring the heartbeat directory exists with correct ownership.

4. **Tests**: Added 4 new tests: `test_write_heartbeat_creates_file`, `test_write_heartbeat_atomic_replace`, `test_poll_once_writes_heartbeat`, `test_poll_once_writes_heartbeat_on_error`. Updated existing tests to use temp heartbeat files. All 33 tests pass.

## Verification

Ran `python -m pytest backend/tests/test_email_worker.py -v` — all 33 tests pass (0 failures). Verified:
- `test_write_heartbeat_creates_file`: heartbeat file created with valid ISO timestamp
- `test_write_heartbeat_atomic_replace`: no .tmp leftover after atomic replace; timestamps differ between writes
- `test_poll_once_writes_heartbeat`: heartbeat written after successful poll
- `test_poll_once_writes_heartbeat_on_error`: heartbeat still written via finally block when IMAP fails
- All pre-existing tests continue to pass (no regressions)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -m pytest backend/tests/test_email_worker.py -v` | 0 | pass | 3100ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
