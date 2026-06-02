---
estimated_steps: 11
estimated_files: 1
skills_used: []
---

# T02: Test error path end-to-end scenarios with DLQ

## Why
Production failures must route to FailedTask DLQ without blocking pipeline. Error paths tested in isolation (S03-S04) need E2E validation.

## Do
1. Extend `test_s06_e2e_integration.py` with error path tests:
   - `test_llm_parse_failure_routes_to_dlq()` — Mock LLM to raise RateLimitError, verify FailedTask created, no notification dispatched
   - `test_verification_error_routes_to_dlq()` — Mock verifier to raise ValueError, verify FailedTask.created_at populated, error notification dispatched
   - `test_notification_failure_non_blocking()` — Mock Telegram to raise exception, verify task completes (non-blocking per MEM037), error logged
2. Use call_parse_invoice_task() and call_verify_invoice_task() helpers
3. Assert: FailedTask record exists in database, task doesn't raise exception to caller

## Done when
All error path tests pass, confirming failures are captured gracefully without breaking the pipeline.

## Inputs

- `backend/tests/test_s03_integration.py`
- `backend/tests/test_s04_integration.py`
- `backend/models.py`

## Expected Output

- `backend/tests/test_s06_e2e_integration.py`

## Verification

cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestErrorPathE2E -v

## Observability Impact

Error path tests verify FailedTask DLQ persistence and non-blocking notification pattern
