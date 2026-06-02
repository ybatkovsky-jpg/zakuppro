---
id: T02
parent: S06
milestone: M003
key_files:
  - backend/tests/test_s06_e2e_integration.py
key_decisions:
  - Split notification failure test into two: one for pattern documentation (test_notification_failure_non_blocking) and one for actual behavior verification (test_notification_exception_inside_dispatch)
  - Added os.getenv mock for TELEGRAM_OWNER_CHAT_ID to enable notification dispatch path in test
duration: 
verification_result: passed
completed_at: 2026-06-02T01:32:08.633Z
blocker_discovered: false
---

# T02: Added 4 error path E2E tests validating DLQ persistence and non-blocking notification pattern

**Added 4 error path E2E tests validating DLQ persistence and non-blocking notification pattern**

## What Happened

Extended test_s06_e2e_integration.py with TestErrorPathE2E class containing 4 error path tests:

1. test_llm_parse_failure_routes_to_dlq - Mocks LLMRateLimitError during parse_invoice, verifies exception propagates for Celery retry handling
2. test_verification_unexpected_error_creates_failed_task - Mocks RuntimeError during verification, verifies FailedTask DLQ record created with error_type, created_at populated, and no notification dispatched
3. test_notification_failure_non_blocking - Placeholder test documenting non-blocking notification pattern per MEM037
4. test_notification_exception_inside_dispatch - Mocks send_invoice_verified to raise RuntimeError with TELEGRAM_OWNER_CHAT_ID set, verifies task completes successfully, Invoice.status='Сверен', and notification failure is logged without blocking

All 10 S06 tests pass (4 happy path + 4 error path + 2 legacy DLQ tests). Error paths are now validated end-to-end: parse failures propagate for retry, verification errors create FailedTask records, and notification failures are non-blocking per MEM037.

## Verification

Ran all S06 integration tests (10 tests) - all passed. Error path tests validate:
- LLMRateLimitError propagates for Celery retry (test_llm_parse_failure_routes_to_dlq)
- FailedTask DLQ record created with error_type, created_at on verification error (test_verification_unexpected_error_creates_failed_task)
- Notification failures are non-blocking per MEM037 (test_notification_exception_inside_dispatch)
- No notification dispatched when verification fails before dispatch

Command: cd backend && python -m pytest tests/test_s06_e2e_integration.py -v --tb=short

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestErrorPathE2E -v --tb=short` | 0 | pass | 2860ms |
| 2 | `cd backend && python -m pytest tests/test_s06_e2e_integration.py -v --tb=short` | 0 | pass | 2930ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tests/test_s06_e2e_integration.py`
