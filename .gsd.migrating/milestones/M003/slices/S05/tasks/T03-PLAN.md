---
estimated_steps: 19
estimated_files: 2
skills_used: []
---

# T03: Integrate notification dispatch with verify_invoice_task

## Why
Notifications must trigger automatically after verification completes. S04's verify_invoice_task needs notification hook.

## Do
1. Add notification dispatch to backend/tasks.py after verification completes:
   - Import telegram_notifier functions
   - Import email_notifier
   - After verification result, route to notification based on verdict
2. Create `dispatch_invoice_notifications(result, invoice_id)` helper:
   - `verified` → send_invoice_verified to TELEGRAM_OWNER_CHAT_ID
   - `partial` → send_invoice_partial to TELEGRAM_OWNER_CHAT_ID
   - `clarification_needed` → send_clarification_email (supplier) + send_invoice_clarification_needed (owner)
   - `failed` → send_invoice_failed to TELEGRAM_OWNER_CHAT_ID
3. Fetch supplier email from PurchaseOrder.supplier.email for clarification
4. Add integration test: create invoice → verify → check notifications dispatched

## Done when
- dispatch_invoice_notifications added to tasks.py
- Called after verify_invoice succeeds
- Integration test in backend/tests/test_s05_notifications_integration.py
- Test creates invoice, calls verify_invoice_task, asserts notification routing

## Inputs

- `backend/tasks.py`
- `backend/telegram_notifier.py`
- `backend/email_notifier.py`
- `backend/services/invoice_verifier.py`
- `backend/schemas/verification.py`

## Expected Output

- `backend/tasks.py`
- `backend/tests/test_s05_notifications_integration.py`

## Verification

pytest backend/tests/test_s05_notifications_integration.py -v
