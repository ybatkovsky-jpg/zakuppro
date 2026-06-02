# S05: Notifications + Clarification Flow

**Goal:** Build notification infrastructure for invoice verification outcomes: Telegram notifications for owner, SMTP clarification emails to suppliers when fuzzy matching detects discrepancies
**Demo:** Telegram notification sent on invoice verification (success/partial/failure). Clarification email sent via SMTP to supplier when fuzzy match detected. User can reply via email or Telegram to resolve.

## Must-Haves

- Telegram notifications sent for all verification verdicts (verified, partial, clarification_needed, failed)
- SMTP clarification emails sent to suppliers when fuzzy_match detected
- Email notifier uses aiosmtplib with async pattern matching telegram_notifier
- Notifications integrate with verify_invoice_task Celery workflow
- Unit tests for all notification functions
- Integration test for full verify → notify flow

## Proof Level

- This slice proves: Integration test with database verification: create invoice → verify → check notification dispatch

## Integration Closure

verify_invoice_task returns verdict → notification_router dispatches to appropriate channel (Telegram owner, SMTP supplier) based on verdict. S06 can test full email → IMAP → parse → verify → notify pipeline

## Verification

- Notification functions log success/failure with structured messages. Failed notifications don't block invoice processing (non-critical per MEM037). Tests verify notification content and routing

## Tasks

- [x] **T01: Extend telegram_notifier.py with invoice-specific notification functions** `est:30m`
  ## Why
  Invoice verification outcomes need owner notification. Existing telegram_notifier.py has completion messages only.
  - Files: `backend/telegram_notifier.py`, `backend/tests/test_telegram_notifications.py`
  - Verify: pytest backend/tests/test_telegram_notifications.py -v

- [x] **T02: Create email_notifier.py for SMTP clarification emails to suppliers** `est:45m`
  ## Why
  Suppliers need clarification requests when invoice items don't match BOM exactly. R007 requires SMTP outbound capability.
  - Files: `backend/email_notifier.py`, `backend/tests/test_email_notifier.py`
  - Verify: pytest backend/tests/test_email_notifier.py -v

- [ ] **T03: Integrate notification dispatch with verify_invoice_task** `est:45m`
  ## Why
  Notifications must trigger automatically after verification completes. S04's verify_invoice_task needs notification hook.
  - Files: `backend/tasks.py`, `backend/tests/test_s05_notifications_integration.py`
  - Verify: pytest backend/tests/test_s05_notifications_integration.py -v

## Files Likely Touched

- backend/telegram_notifier.py
- backend/tests/test_telegram_notifications.py
- backend/email_notifier.py
- backend/tests/test_email_notifier.py
- backend/tasks.py
- backend/tests/test_s05_notifications_integration.py
