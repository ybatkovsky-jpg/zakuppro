---
estimated_steps: 14
estimated_files: 2
skills_used: []
---

# T01: Extend telegram_notifier.py with invoice-specific notification functions

## Why
Invoice verification outcomes need owner notification. Existing telegram_notifier.py has completion messages only.

## Do
Add 4 invoice-specific notification functions to backend/telegram_notifier.py:
1. `send_invoice_verified(chat_id, invoice_id, stats)` - Success message with match statistics
2. `send_invoice_partial(chat_id, invoice_id, discrepancies)` - Warning for quantity discrepancies
3. `send_invoice_clarification_needed(chat_id, invoice_id, fuzzy_matches)` - Alert for fuzzy matches requiring supplier contact
4. `send_invoice_failed(chat_id, invoice_id, error)` - Critical alert for verification failures

Follow existing pattern: use `_get_bot()`, return `bool` on failure, log errors (non-critical per MEM037). Use Russian messages matching existing style.

## Done when
- 4 new functions added to telegram_notifier.py
- Each function returns bool for success/failure
- Functions follow existing error handling pattern
- Unit tests in backend/tests/test_telegram_notifications.py (4 test cases)

## Inputs

- `backend/telegram_notifier.py`

## Expected Output

- `backend/telegram_notifier.py`
- `backend/tests/test_telegram_notifications.py`

## Verification

pytest backend/tests/test_telegram_notifications.py -v
