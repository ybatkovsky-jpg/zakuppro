---
estimated_steps: 19
estimated_files: 2
skills_used: []
---

# T03: Wire retry_sync into telegram_notifier.py all 6 public notification functions

Why: Telegram Bot API calls are HTTP-based and subject to transient network errors (timeout, connection reset, 5xx). Currently TelegramError is caught and returns False silently. Adding retry means a brief Telegram API outage doesn't lose a notification to the user.

Do:
1. Apply @retry_sync(retryable_exceptions=(TelegramError,)) to all 6 public functions:
   - send_completion_message()
   - send_dlq_alert()
   - send_invoice_verified()
   - send_invoice_partial()
   - send_invoice_clarification_needed()
   - send_invoice_failed()
2. In each function, remove the `except TelegramError` catch — the decorator now handles retry. Keep the broad `except Exception` for unexpected non-Telegram errors.
3. Config/bot-unavailable checks (_get_bot() returning None, missing OWNER_CHAT_ID) remain BEFORE the bot call and return False immediately — no retry wasted on misconfiguration.
4. In backend/tests/test_telegram_notifications.py, add TestTelegramRetry class with:
   - test_retry_on_telegramerror_then_succeed: mock fails with TelegramError twice, succeeds on 3rd
   - test_retry_on_telegramerror_all_exhausted: always fails → returns False after 3 attempts
   - test_no_retry_on_non_telegram_error: mock raises ValueError → no retry, returns False immediately
   - test_no_retry_when_bot_unavailable: _get_bot returns None → False immediately, 0 retries
   - test_retry_attempt_count: verify send_message called exactly 3 times
   - test_success_path_unchanged: normal success still works

Done when: `pytest backend/tests/test_telegram_notifications.py -v` passes all existing + new retry tests

## Inputs

- `backend/retry_utils.py`
- `backend/telegram_notifier.py`
- `backend/tests/test_telegram_notifications.py`

## Expected Output

- `backend/telegram_notifier.py`
- `backend/tests/test_telegram_notifications.py`

## Verification

pytest backend/tests/test_telegram_notifications.py -v
