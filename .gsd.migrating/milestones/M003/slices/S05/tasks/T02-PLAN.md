---
estimated_steps: 18
estimated_files: 2
skills_used: []
---

# T02: Create email_notifier.py for SMTP clarification emails to suppliers

## Why
Suppliers need clarification requests when invoice items don't match BOM exactly. R007 requires SMTP outbound capability.

## Do
Create backend/email_notifier.py with async SMTP client:
1. `send_clarification_email(supplier_email, invoice_data, unmatched_items)` - Uses aiosmtplib
2. Email template in Russian: lists fuzzy-matched items, requests confirmation
3. Environment variables: SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD (already configured)
4. Async pattern matching telegram_notifier: return bool, log errors, non-critical

Email content includes:
- Supplier name, invoice number
- List of fuzzy-matched items (invoice vs expected)
- Request for confirmation/reply

## Done when
- email_notifier.py created with send_clarification_email function
- Uses aiosmtplib for async SMTP (already in requirements)
- Email template renders in Russian
- Unit tests mock SMTP to verify email content
- Error handling follows non-critical pattern (return bool, log)

## Inputs

- `backend/requirements.txt`

## Expected Output

- `backend/email_notifier.py`
- `backend/tests/test_email_notifier.py`

## Verification

pytest backend/tests/test_email_notifier.py -v
