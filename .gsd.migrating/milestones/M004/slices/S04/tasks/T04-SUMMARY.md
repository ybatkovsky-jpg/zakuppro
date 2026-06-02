---
id: T04
parent: S04
milestone: M004
key_files:
  - backend/tasks.py
  - backend/tests/test_match_bank_transactions_task.py
key_decisions:
  - Used mutually exclusive bank_statement_id/bank_transaction_id parameters instead of single generic id parameter for explicit API surface and clearer calling patterns
  - Followed parse_bank_statement pattern for bind=True, max_retries=2, exponential backoff, and FailedTask DLQ for consistency across tasks
  - Logger statements at each stage (task start, DB session, matcher init, matching call, result summary) for observability
duration: 
verification_result: passed
completed_at: 2026-06-02T10:44:53.114Z
blocker_discovered: false
---

# T04: Added match_bank_transactions Celery task with bind=True, max_retries=2, exponential backoff on RateLimitError, and FailedTask DLQ persistence

**Added match_bank_transactions Celery task with bind=True, max_retries=2, exponential backoff on RateLimitError, and FailedTask DLQ persistence**

## What Happened

Created match_bank_transactions Celery task following the parse_bank_statement pattern. Task accepts either bank_statement_id or bank_transaction_id (mutually exclusive, validated), calls PaymentMatcher, and returns dict with status, matched_count, unresolved_count, payment_ids, and errors. Includes bind=True for task request access, max_retries=2 with exponential backoff on RateLimitError, and FailedTask DLQ persistence on final failure. Logger statements added for each stage: task start, database session creation, PaymentMatcher initialization, matching method call, result summary, and completion. 10 tests verify execution modes, input validation, DB session cleanup, FailedTask creation, and logger observability.

## Verification

pytest backend/tests/test_match_bank_transactions_task.py -v - 10 tests passed covering task execution modes, input validation (missing params, mutually exclusive params), FailedTask DLQ persistence, DB session cleanup on success/error, result structure, and logger statements

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_match_bank_transactions_task.py -v` | 0 | pass | 6220ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tasks.py`
- `backend/tests/test_match_bank_transactions_task.py`
