---
id: T02
parent: S02
milestone: M003
key_files:
  - backend/email_worker.py
  - backend/tasks.py
  - backend/tests/test_email_worker.py
key_decisions:
  - Separate EmailWorker class for testability
  - File-based persistence for processed Message-IDs
  - Configurable poll interval via environment
  - Graceful shutdown via SIGTERM/SIGINT
  - Statistics tracking for observability
  - Placeholder parse_invoice task for S03 integration
duration: 
verification_result: untested
completed_at: 2026-06-01T13:54:01.168Z
blocker_discovered: false
---

# T02: Created EmailWorker service with poll_forever loop, duplicate detection by Message-ID, and parse_invoice task placeholder. 24 unit tests pass.

**Created EmailWorker service with poll_forever loop, duplicate detection by Message-ID, and parse_invoice task placeholder. 24 unit tests pass.**

## What Happened

## T02: Email Worker Service

Implemented backend/email_worker.py with EmailWorker class and placeholder parse_invoice task.

**EmailWorker Features:**
- `poll_forever()` main loop with configurable poll interval (default 60s)
- Duplicate detection via Message-ID persistence to file
- `process_email()` extracts attachments and publishes parse_invoice tasks
- Graceful shutdown on SIGTERM/SIGINT with signal handlers
- Statistics tracking: emails_processed, attachments_extracted, tasks_published, errors
- Environment-based configuration via `create_imap_client_from_env()`

**parse_invoice Task:**
- Added placeholder task in tasks.py for S03 implementation
- Accepts filename, file_content, metadata parameters
- Returns structured result with status, items_count, message_id

**Unit Tests:** 24 tests covering:
- Initialization and configuration
- Processed ID persistence and duplicate detection
- Email processing with/without attachments
- Task publication success/failure
- Poll loop behavior and graceful shutdown
- Main entry point with environment variables

## Verification

cd backend && python -m pytest tests/test_email_worker.py -v

Result: 24/24 tests passed in 1.67s
- EmailWorker tests (21): init, persistence, duplicate detection, email processing, poll loop, shutdown
- Main tests (3): environment configuration, defaults, fatal error handling

**Coverage:** All public methods and error paths tested.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/email_worker.py`
- `backend/tasks.py`
- `backend/tests/test_email_worker.py`
