# S02: Retry with Exponential Backoff — UAT

**Milestone:** M007
**Written:** 2026-06-05T02:31:28.972Z

# S02 UAT: Retry with Exponential Backoff

## UAT Type: Integration

## Preconditions
- All services running (docker-compose up)
- Valid SMTP configuration in `.env`
- Valid Telegram bot token and chat IDs in `.env`
- pytest installed

## Test Cases

### TC1: Retry utility functions correctly (unit)
1. Run `pytest backend/tests/test_retry_utils.py -v`
2. **Expected:** All 13 tests pass, covering sync and async retry decorators with success, retry-then-succeed, exhaustion, non-retryable skip, backoff timing, jitter, and metadata preservation.

### TC2: Email retry on SMTP failure (integration)
1. Run `pytest backend/tests/test_email_notifier.py -v`
2. **Expected:** All 25 tests pass. TestEmailRetry class verifies retry on SMTPException triggers retry with backoff, non-SMTP exceptions skip retry, and all retries exhausted returns False.

### TC3: Telegram retry on TelegramError (integration)
1. Run `pytest backend/tests/test_telegram_notifications.py -v`
2. **Expected:** All 23 tests pass. TestTelegramRetry class verifies retry on TelegramError triggers retry with backoff, non-TelegramError exceptions skip retry, bot-unavailable skips retry, and success path is unchanged.

### TC4: Retry does not break existing notification flow
1. In a running system, send a BOM file via Telegram bot
2. **Expected:** Status notifications arrive normally. No change in notification delivery behavior for successful API calls.

### TC5: Observability — retry logging
1. Simulate a transient Telegram API failure (e.g., temporarily block outbound traffic to api.telegram.org)
2. **Expected:** Logs show WARNING-level `"Retry 1/3 for send_invoice_verified: ..."` messages, followed by either success or ERROR `"All retries exhausted"`.

## Edge Cases
- **Non-retryable exception (auth failure):** TelegramError for unauthorized → returns False immediately, no retry
- **Missing config:** No SMTP config → returns False before any retry attempt
- **Bot unavailable:** `_get_bot()` returns None → returns False, no retry
- **Multiple concurrent failures:** Each function retries independently with its own backoff + jitter

## Not Proven By This UAT
- Real network failures against live Telegram/SMTP APIs (uses mocks)
- Race conditions with very high concurrency
- Interaction with Celery task retry (separate layer, tested in M002)
