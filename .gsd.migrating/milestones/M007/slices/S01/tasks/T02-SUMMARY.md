---
id: T02
parent: S01
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-04T12:56:46.615Z
blocker_discovered: false
---

# T02: Created test_health.py with 13 tests covering /health endpoint degraded states and heartbeat file check unit tests

**Created test_health.py with 13 tests covering /health endpoint degraded states and heartbeat file check unit tests**

## What Happened

The health.py and main.py files already contained the required changes from T01 (check_email_worker, check_telegram_bot, lifespan context manager). The work for T02 was creating comprehensive test coverage for the /health endpoint.

Created backend/tests/test_health.py with 13 tests across 3 test classes:

**TestHealthEndpoint (5 tests):** API-level tests using FastAPI TestClient with mocked external dependencies:
- test_health_all_ok: All 5 services healthy → 200 with email_worker and telegram_bot fields present
- test_health_email_worker_degraded: Patched email_worker='error' → 503 with detail.email_worker='error'
- test_health_telegram_bot_degraded: Patched telegram_bot='error' → 503 with detail.telegram_bot='error'
- test_health_db_down: Mock DB session raising SQLAlchemyError → 503 with detail.db='error'
- test_health_rabbitmq_down: Patched rabbitmq='error' → 503 with detail.rabbitmq='error'

**TestCheckEmailWorker (4 tests):** Unit tests using tmp_path for real heartbeat file I/O:
- test_ok_with_fresh_heartbeat: Fresh UTC timestamp → 'ok'
- test_error_missing_file: No file → 'error'
- test_error_stale_heartbeat: 200s-old timestamp with 120s max_age → 'error'
- test_error_unparseable: Garbage content → 'error'

**TestCheckTelegramBot (4 tests):** Same pattern with 90s threshold.

The test_health_db_down test required careful handling of FastAPI's dependency override mechanism — passing a generator function (not a generator object) so FastAPI's signature inspection works correctly.

## Verification

Ran python -m pytest backend/tests/test_health.py -v — all 13 tests pass (0 failures). Verified:
- /health returns 200 with all 'ok' statuses when all services are healthy
- /health returns 503 when any service is degraded (email_worker, telegram_bot, db, rabbitmq)
- check_email_worker() correctly handles fresh heartbeat, missing file, stale heartbeat, and unparseable content
- check_telegram_bot() correctly handles fresh heartbeat, missing file, stale heartbeat, and unparseable content
- The response includes email_worker and telegram_bot fields as required by R016

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -m pytest backend/tests/test_health.py -v` | 0 | pass | 2470ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
