# S02: Retry with Exponential Backoff

**Goal:** Wrap all external call sites lacking retry (email SMTP via aiosmtplib, Telegram Bot API via python-telegram-bot) with reusable exponential-backoff + jitter retry decorators. Existing LLM and Celery retry remain unchanged.
**Demo:** Искусственный сбой OpenAI API → автоматический retry с растущей задержкой → успешный ответ или graceful failure

## Must-Haves

- retry_utils.py provides sync and async retry decorators matching existing codebase patterns (RETRY_DELAYS=[1,2,4] equivalent, max_retries=3) with jitter
- All 6 Telegram notification functions retry on TelegramError (up to 3 attempts, exponential backoff + jitter)
- Both email functions (send_clarification_email, send_test_email) retry on SMTPException (up to 3 attempts, exponential backoff + jitter)
- Non-retryable errors still fail immediately (return False) — no retry wasted on auth failures or invalid recipients
- Unit tests verify: retry count, backoff timing, jitter presence, non-retryable skip, max-retry exhaustion
- Pre-existing retry in llm_provider.py, ai_agent.py, tasks.py, services/imap_client.py is untouched
- pytest backend/tests/test_retry_utils.py backend/tests/test_email_notifier.py backend/tests/test_telegram_notifications.py -v passes

## Proof Level

- This slice proves: contract

## Integration Closure

Upstream: aiosmtplib.SMTPException, telegram.error.TelegramError, codebase retry convention (RETRY_DELAYS=[1,2,4], max_retries=3). New wiring: @retry_async decorator on 2 email functions, @retry_sync decorator on 6 Telegram functions. No new dependency — manual implementation consistent with llm_provider.py pattern. Nothing remains for the retry story: LLM, Celery, and IMAP already have retry; this slice closes the final gaps.

## Verification

- Each retry attempt logs at WARNING with function name, attempt number, and exception. Final exhaustion logs at ERROR. Non-retryable errors still log at ERROR inside the function. A future agent can grep for "Retry \d+/\d+ for" to see retry activity and "All retries exhausted" for permanent failures.

## Tasks

- [x] **T01: Create retry_utils.py with sync and async retry decorators + unit tests** `est:45m`
  Why: The codebase has 4 separate manual retry implementations. A shared utility prevents divergence and gives a single place to test retry behavior. This task creates the foundation that T02 and T03 wire into.
  - Files: `backend/retry_utils.py`, `backend/tests/test_retry_utils.py`
  - Verify: pytest backend/tests/test_retry_utils.py -v

- [x] **T02: Wire retry_async into email_notifier.py send_clarification_email and send_test_email** `est:30m`
  Why: SMTP connections are inherently transient — connection refused, TLS negotiation failure, temporary server errors. Currently these are silently swallowed with return False. Adding retry means a brief SMTP outage doesn't lose the clarification email to the supplier.
  - Files: `backend/email_notifier.py`, `backend/tests/test_email_notifier.py`
  - Verify: pytest backend/tests/test_email_notifier.py -v

- [ ] **T03: Wire retry_sync into telegram_notifier.py all 6 public notification functions** `est:35m`
  Why: Telegram Bot API calls are HTTP-based and subject to transient network errors (timeout, connection reset, 5xx). Currently TelegramError is caught and returns False silently. Adding retry means a brief Telegram API outage doesn't lose a notification to the user.
  - Files: `backend/telegram_notifier.py`, `backend/tests/test_telegram_notifications.py`
  - Verify: pytest backend/tests/test_telegram_notifications.py -v

## Files Likely Touched

- backend/retry_utils.py
- backend/tests/test_retry_utils.py
- backend/email_notifier.py
- backend/tests/test_email_notifier.py
- backend/telegram_notifier.py
- backend/tests/test_telegram_notifications.py
