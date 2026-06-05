---
id: S02
parent: M007
milestone: M007
provides:
  - retry_utils.py with retry_sync and retry_async decorators
  - Retry on SMTPException for 2 email notification functions
  - Retry on TelegramError for 6 Telegram notification functions
  - 61 tests covering all retry scenarios
requires:
  []
affects:
  []
key_files:
  - backend/retry_utils.py
  - backend/tests/test_retry_utils.py
  - backend/email_notifier.py
  - backend/tests/test_email_notifier.py
  - backend/telegram_notifier.py
  - backend/tests/test_telegram_notifications.py
key_decisions:
  - Return False (not raise) when all retries exhausted — matches existing non-critical failure pattern from email/telegram modules
  - Jitter is additive (base_delay * 2**attempt + random.uniform(0,1)), not multiplicative — matches explicit task spec
  - Default max_retries=3 and base_delay=1 match LLM_MAX_RETRIES and RETRY_DELAYS from llm_provider.py
  - SMTPException and TelegramError re-raised to decorator for retry; non-retryable exceptions return False immediately
patterns_established:
  - Exponential backoff with additive jitter: base_delay * 2**attempt + random.uniform(0, 1)
  - Non-critical failure pattern: re-raise retryable exceptions to decorator, return False for non-retryable, config-failure short-circuits before retry
observability_surfaces:
  - WARNING: 'Retry N/M for func_name: exception' on each retry attempt
  - ERROR: 'All retries exhausted for func_name: exception' on final failure
  - Grep-able patterns: 'Retry \d+/\d+ for' and 'All retries exhausted'
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-06-05T02:31:28.967Z
blocker_discovered: false
---

# S02: Retry with Exponential Backoff

**Created retry_utils.py with sync/async exponential-backoff + jitter decorators, wired into all 6 Telegram and 2 email notification functions — 61 tests pass covering retry count, backoff timing, jitter, non-retryable skip, and max-retry exhaustion.**

## What Happened

## T01: Created retry_utils.py with sync and async retry decorators (13 tests)

Created `backend/retry_utils.py` with two decorators matching existing codebase conventions:
- `retry_sync(max_retries=3, base_delay=1.0, retryable_exceptions=(Exception,))` — for sync Telegram functions, uses `time.sleep` with exponential backoff `base_delay * 2**attempt + random.uniform(0, 1)` jitter
- `retry_async(max_retries=3, base_delay=1.0, retryable_exceptions=(Exception,))` — for async email functions, uses `asyncio.sleep` with same backoff formula

Key design decisions:
- Default `max_retries=3` matches `LLM_MAX_RETRIES` from `llm_provider.py`
- Default `base_delay=1` produces `[1, 2, 4]` delays matching existing `RETRY_DELAYS`
- Returns `False` when all retries exhausted (non-critical failure pattern consistent with existing email/Telegram modules)
- `functools.wraps` preserves function metadata
- Logs WARNING on each retry (`"Retry N/M for func_name: exception"`), ERROR on exhaustion (`"All retries exhausted for func_name: exception"`)
- Non-retryable exceptions propagate immediately

Created `backend/tests/test_retry_utils.py` with 13 tests covering success, retry-then-succeed, exhaustion, non-retryable propagation, backoff timing, jitter presence, metadata preservation, and default parameter verification.

## T02: Wired retry_async into email_notifier.py (25 tests, 6 retry-specific)

Both `send_clarification_email` and `send_test_email` already had `@retry_async(retryable_exceptions=_SMTP_RETRY_EXCEPTIONS)` decorators applied. The implementation:
- Re-raises SMTPException from the inner try/except so the decorator handles retry with backoff
- Catches non-retryable Exception types and returns False immediately (no retry wasted)
- Short-circuits on missing SMTP config before any retry attempt
- Uses `_SMTP_RETRY_EXCEPTIONS` tuple `(aiosmtplib.SMTPException,)` or `()` when library unavailable

The TestEmailRetry class has 6 tests: retry-then-succeed, all-exhausted, non-smtp-no-retry, attempt-count, success-no-retry, and config-short-circuit. All 25 tests pass.

## T03: Wired retry_sync into telegram_notifier.py (23 tests, 6 retry-specific)

All 6 public telegram_notifier.py functions (`send_completion_message`, `send_dlq_alert`, `send_invoice_verified`, `send_invoice_partial`, `send_invoice_clarification_needed`, `send_invoice_failed`) already had `@retry_sync(retryable_exceptions=(TelegramError,))` decorators applied. Each function catches TelegramError via isinstance check inside the broad `except Exception` block and re-raises it to let the decorator handle retry. Non-TelegramError exceptions are caught and return False immediately. Config/bot-unavailable checks short-circuit with False — no retry wasted on misconfiguration.

The TestTelegramRetry class has 6 tests: retry-then-succeed, all-exhausted, non-telegram-no-retry, bot-unavailable-no-retry, attempt-count, and success-unchanged. All 23 tests pass.

## Cross-Cutting

Pre-existing retry in `llm_provider.py`, `ai_agent.py`, `tasks.py`, and `services/imap_client.py` is untouched. No new dependencies — pure stdlib (time, asyncio, random, functools). The retry story is now fully closed: LLM, Celery, and IMAP already had retry; this slice closed the email and Telegram notification gaps.

## Verification

## Slice-level verification

Ran `pytest backend/tests/test_retry_utils.py backend/tests/test_email_notifier.py backend/tests/test_telegram_notifications.py -v` — **61 passed** in 0.94s.

### test_retry_utils.py (13 tests)
- retry_sync: success first try, retry-then-succeed, exhaustion returns False, non-retryable propagates, backoff timing formula verified, jitter applied, metadata preserved, defaults correct
- retry_async: success first try, retry-then-succeed, exhaustion returns False, non-retryable propagates, metadata preserved

### test_email_notifier.py (25 tests, 6 retry-specific)
- TestEmailRetry: retry on SMTPException then succeed, all retries exhausted returns False, no retry on non-SMTP exception, retry attempt count correct, success path unchanged, respects config

### test_telegram_notifications.py (23 tests, 6 retry-specific)
- TestTelegramRetry: retry on TelegramError then succeed, all retries exhausted returns False, no retry on non-TelegramError, no retry when bot unavailable, retry attempt count correct, success path unchanged

### Observability verified
- Each retry attempt logs WARNING with function name, attempt number, and exception
- Final exhaustion logs ERROR
- Non-retryable errors still log inside the function at ERROR
- Future agent can grep for `"Retry \d+/\d+ for"` and `"All retries exhausted"`

## Requirements Advanced

- R019 — Delivered retry with exponential backoff + jitter for all email and Telegram external calls. retry_utils.py provides reusable sync/async decorators. LLM and Celery retry already existed — this closes the final notification pathway gaps.

## Requirements Validated

- R019 — 61 tests pass across test_retry_utils.py (13), test_email_notifier.py (25), test_telegram_notifications.py (23). All retry scenarios covered: retry-then-succeed, exhaustion, non-retryable skip, backoff timing, jitter, attempt counting, and success-path unchanged.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

None.
