---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T04: Create Celery Task for Payment Matching

Add match_bank_transactions task to tasks.py following parse_bank_statement pattern. Task takes bank_statement_id or bank_transaction_id, calls PaymentMatcher, returns dict with status, matched_count, unresolved_count, payment_ids. Include bind equals True, max_retries equals 2, exponential backoff on RateLimitError, FailedTask DLQ on final failure. Add logger statements for each stage.

## Inputs

- `backend/services/payment_matcher.py`
- `backend/tasks.py`
- `backend/celery_app.py`

## Expected Output

- `backend/tasks.py`
- `backend/tests/test_match_bank_transactions_task.py`

## Verification

pytest backend/tests/test_match_bank_transactions_task.py -v

## Observability Impact

Logger statements for task start, matcher call, result counts, DLQ persistence
