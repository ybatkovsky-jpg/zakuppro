# S02 Research: Retry with Exponential Backoff

## Summary

This slice adds retry-with-exponential-backoff to all external call sites that currently lack it. Three external service categories need attention: LLM API calls (OpenAI, Anthropic, Gemini), email sending (SMTP via aiosmtplib), and Telegram Bot API notifications. The LLM layer already has retry built in; the gaps are in email and Telegram, where failures are silently swallowed.

## Requirements Coverage

- **R019 -- Retry with exponential backoff for all external calls (OpenAI API, email, bank API)**
  - Status: partially implemented
  - What is needed: retry wrapping for email SMTP calls and Telegram Bot API calls. LLM calls (OpenAI, Anthropic, Gemini) already have retry. "Bank API" in this context refers to the SMTP-based email notification pathway and Telegram API -- there is no direct bank API call in the codebase.

## Implementation Landscape

### Files to Touch

| File | Purpose | Retry Status |
|---|---|---|
| `backend/email_notifier.py` | SMTP email sending via aiosmtplib (`send_clarification_email`, `send_test_email`) | NO retry -- returns False on failure |
| `backend/telegram_notifier.py` | Telegram Bot API calls (`send_completion_message`, `send_dlq_alert`, `send_invoice_verified`, etc.) | NO retry -- returns False on failure |
| `backend/llm_provider.py` | LLM provider base class with per-provider retry | ALREADY has retry (RETRY_DELAYS=[1,2,4], max_retries=3, fallback between providers) |
| `backend/ai_agent.py` | Legacy AI agent with its own retry | ALREADY has retry (RETRY_DELAYS=[1,2,4], MAX_RETRIES=3) |
| `backend/tasks.py` | All Celery task definitions | ALREADY has Celery-level retry (max_retries=2, countdown=2**retry_count) |
| `backend/services/imap_client.py` | IMAP connection with retry | ALREADY has retry (max_retries=3, retry_delay*2**attempt) |
| `backend/requirements.txt` | Dependencies -- check if tenacity is available | tenacity NOT listed; httpx IS listed (0.27.2) |

### Natural Seams (Independent Work Units)

1. **Retry decorator / utility module** -- Create `backend/retry_utils.py` with a reusable retry decorator using manual implementation, with configurable backoff, max_retries, retryable exceptions, and logging. This is the foundation.

2. **Wire retry into email_notifier.py** -- Wrap `send_clarification_email()` and `send_test_email()` with retry for transient SMTP errors (e.g., connection refused, TLS handshake failure). Non-retryable errors (auth failure, invalid recipient) should still fail immediately.

3. **Wire retry into telegram_notifier.py** -- Wrap all 6 public functions with retry for `TelegramError` (network-level). Non-retryable errors should still fail immediately.

### First Proof

The highest-risk item is the retry decorator itself. Verify it with a unit test before wiring anything:

1. Create `backend/retry_utils.py` with a `@retry` decorator
2. Test: mock a function that fails N times then succeeds -- verify it retries with correct backoff delays
3. Test: mock a function that always fails with a non-retryable error -- verify it does NOT retry
4. Only then wire it into `email_notifier.py` and `telegram_notifier.py`

## Key Findings

### What Exists

**LLM provider** (`llm_provider.py`):
- `BaseLLMProvider.call()` uses manual retry loop with `RETRY_DELAYS = [1, 2, 4]` and configurable `max_retries` (default 3)
- Distinguishes rate-limit errors (retry), timeout errors (retry), and non-retryable errors (fail immediately)
- `LLMProvider` class adds cross-provider fallback (primary -> secondary)
- Environment config: `LLM_MAX_RETRIES`, `LLM_TIMEOUT_SECONDS`

**AI agent** (`ai_agent.py`):
- Same pattern: manual retry loop with `RETRY_DELAYS = [1, 2, 4]`, `MAX_RETRIES = 3`
- Only handles OpenAI (legacy path)

**Celery tasks** (`tasks.py`):
- Every task follows the same pattern: `bind=True, max_retries=2`, catch `RateLimitError`, call `self.retry(exc=e, countdown=2**retry_count, max_retries=2)`
- Non-retryable errors (ValueError, etc.) go directly to DLQ via `FailedTask` persistence
- Tasks with this pattern: `parse_excel_bom`, `process_bom_to_project`, `parse_invoice`, `verify_invoice_task`, `parse_bank_statement`, `match_bank_transactions`

**IMAP client** (`services/imap_client.py`):
- Connection retry with exponential backoff: `delay = self.retry_delay * (2 ** attempt)`, `max_retries = 3`
- Authentication errors are NOT retried

**Dependencies** (`requirements.txt`):
- `httpx==0.27.2` is installed (could be used for any HTTP-based retry)
- `tenacity` is NOT installed -- would need to be added
- `openai==1.54.0`, `anthropic==0.40.0`, `google-generativeai==0.8.3` -- these SDKs throw their own exception types

### What's Missing

**Email (SMTP) -- `email_notifier.py`:**
- `send_clarification_email()`: Catches `aiosmtplib.SMTPException` and returns `False`. **No retry.** Transient SMTP failures (connection refused, temporary server error) are silently dropped.
- `send_test_email()`: Same pattern. **No retry.**
- These are called from `tasks.py` `dispatch_invoice_notifications()` in a fire-and-forget manner (via `loop.run_until_complete()`). A transient SMTP outage means the supplier never gets the clarification email.

**Telegram Bot API -- `telegram_notifier.py`:**
- All 6 public functions (`send_completion_message`, `send_dlq_alert`, `send_invoice_verified`, `send_invoice_partial`, `send_invoice_clarification_needed`, `send_invoice_failed`): Catch `TelegramError` and return `False`. **No retry.**
- The `python-telegram-bot` library uses HTTP under the hood. Transient network errors (timeout, connection reset) are silently dropped.
- These are called from Celery tasks and the notification dispatcher. A transient Telegram API outage means the user never gets notified.

**Library gap:**
- No `tenacity` or `stamina` in `requirements.txt`. The current manual retry loops work but are inconsistent across modules.

### Constraints

1. **Non-critical pattern**: Both email and Telegram notifications follow a "non-critical" pattern -- they return bool and the caller continues. This is intentional (notifications should not block business logic). The retry should follow the same principle: retry transient errors but do NOT block the caller; if all retries are exhausted, return False as before.

2. **Async vs sync**: `email_notifier.py` uses async functions (`async def send_clarification_email`) but is called synchronously via `loop.run_until_complete()` in Celery tasks. The retry decorator must work with async functions or the caller must be refactored.

3. **Existing patterns**: The codebase already has manual retry loops (not tenacity). Adding tenacity introduces a new dependency but provides a consistent, testable pattern. The alternative is to extract the manual pattern into a shared utility.

4. **TelegramError granularity**: `python-telegram-bot`'s `TelegramError` is a base class. The code currently catches the broad `TelegramError`. For retry, we need to distinguish between retryable (network errors, timeout, 503) and non-retryable (auth failed, invalid chat_id).

5. **No direct bank API**: There is no direct bank API HTTP call in the codebase. Bank operations are handled via file import (1C ClientBank .txt parsing in `bank_statement_parser.py`) and local matching logic (`payment_matcher.py`). The "bank API" reference in R019 appears to cover the email notification pathway to suppliers.

## Recommendation

**Approach: Use a shared manual retry utility (no external dependency)**

Rationale:
- The codebase already has multiple manual retry implementations. Extracting a shared utility is consistent with existing patterns.
- `tenacity` is powerful but adds a dependency for a small amount of code (~60 lines).
- A shared utility in `backend/retry_utils.py` can be used by both sync (Telegram) and async (email) callers.

**Proposed implementation plan:**

1. **Create `backend/retry_utils.py`** with:
   - `retry_sync(max_retries=3, base_delay=1, retryable_exceptions=(...))` -- decorator for sync functions
   - `retry_async(max_retries=3, base_delay=1, retryable_exceptions=(...))` -- decorator for async functions
   - Exponential backoff: `delay = base_delay * (2 ** attempt) + random_jitter`
   - Logging at each retry attempt
   - Default retryable exceptions: `ConnectionError`, `TimeoutError`, `IOError`

2. **Wire into `telegram_notifier.py`**: Decorate all 6 public functions with `@retry_sync(retryable_exceptions=(TelegramError,))`, where `TelegramError` is the general network-level error. Exclude non-retryable errors by catching them before the decorator.

3. **Wire into `email_notifier.py`**: Decorate `send_clarification_email()` and `send_test_email()` with `@retry_async(retryable_exceptions=(aiosmtplib.SMTPException,))`.

4. **No changes to**: `llm_provider.py`, `ai_agent.py`, `tasks.py`, `services/imap_client.py` -- these already have retry.

## Verification

```bash
# Unit tests for retry utility
pytest backend/tests/test_retry_utils.py -v

# Integration tests for email with retry
pytest backend/tests/test_email_notifier.py -v

# Integration tests for Telegram with retry
pytest backend/tests/test_telegram_notifications.py -v

# Full integration - simulate SMTP failure then recovery
pytest backend/tests/test_s05_notifications_integration.py -v

# Ensure existing LLM retry still works
pytest backend/tests/test_llm_provider.py -v

# Ensure existing Celery retry still works
pytest backend/tests/test_parse_bank_statement_task.py::test_rate_limit_retries_with_backoff -v
pytest backend/tests/test_match_bank_transactions_task.py::test_task_retry_on_rate_limit_error -v
```