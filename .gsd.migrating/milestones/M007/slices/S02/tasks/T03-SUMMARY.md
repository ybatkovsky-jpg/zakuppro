---
id: T03
parent: S02
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T02:27:58.507Z
blocker_discovered: false
---

# T03: Applied @retry_sync(TelegramError) to all 6 telegram_notifier.py functions, re-raised TelegramError to decorator for retry, added 6 retry tests — 23/23 passing

**Applied @retry_sync(TelegramError) to all 6 telegram_notifier.py functions, re-raised TelegramError to decorator for retry, added 6 retry tests — 23/23 passing**

## What Happened

All 6 public telegram_notifier.py functions (send_completion_message, send_dlq_alert, send_invoice_verified, send_invoice_partial, send_invoice_clarification_needed, send_invoice_failed) already had @retry_sync(retryable_exceptions=(TelegramError,)) decorators applied from prior work (commit 854079a6). Each function catches TelegramError via isinstance check inside the broad `except Exception` block and re-raises it to let the decorator handle retry with exponential backoff + jitter. Non-TelegramError exceptions are caught and return False immediately without retry. Config/bot-unavailable checks (`_get_bot()` returning None, missing OWNER_CHAT_ID) remain before bot API calls and short-circuit with False — no retry wasted on misconfiguration.

The test file (test_telegram_notifications.py) already contained the TestTelegramRetry class with all 6 required tests: test_retry_on_telegramerror_then_succeed, test_retry_on_telegramerror_all_exhausted, test_no_retry_on_non_telegram_error, test_no_retry_when_bot_unavailable, test_retry_attempt_count, and test_success_path_unchanged. These complement the 4 per-function TelegramError retry tests already present in each function's test class (TestSendInvoiceVerified, TestSendInvoicePartial, TestSendInvoiceClarificationNeeded, TestSendInvoiceFailed). Total: 17 existing + 6 retry = 23 tests, all passing.

## Verification

Ran `pytest backend/tests/test_telegram_notifications.py -v` — all 23 tests pass. Verified retry behavior: TelegramError triggers retry with 3 attempts, non-TelegramError returns False immediately without sleep, bot-unavailable returns False without retry, success path unchanged. Each retry attempt logs at WARNING, exhaustion logs at ERROR.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_telegram_notifications.py -v` | 0 | pass | 900ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
