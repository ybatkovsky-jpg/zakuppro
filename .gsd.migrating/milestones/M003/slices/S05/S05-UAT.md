# S05: Notifications + Clarification Flow — UAT

**Milestone:** M003
**Written:** 2026-06-02T00:26:32.975Z

# S05 UAT: Invoice Verification Notifications

## UAT Type
Integration Verification - Notification dispatch after invoice verification

## Preconditions
1. Database populated with test Invoice and InvoiceItem records
2. Telegram bot configured with valid TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_CHAT_ID
3. SMTP configured with SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD (for clarification emails)
4. Celery worker running with tasks.py registered

## Test Cases

### TC1: Verified Invoice Notification
**Steps:**
1. Create an Invoice with verified status and valid owner_chat_id
2. Run dispatch_invoice_notifications with verdict="verified"
3. Check Telegram owner receives notification with match statistics

**Expected:** Telegram message sent with "Счёт #INV-001 проверен ✅" and item count

### TC2: Partial Verdict Notification
**Steps:**
1. Create an Invoice with partial status (quantity discrepancies)
2. Run dispatch_invoice_notifications with verdict="partial"
3. Check Telegram owner receives warning with discrepancies list

**Expected:** Telegram message sent with "⚠️ Частичное совпадение" and mismatched items

### TC3: Clarification Email to Supplier
**Steps:**
1. Create Invoice with clarification_needed verdict and linked PurchaseOrder with supplier_email
2. Run dispatch_invoice_notifications with verdict="clarification_needed"
3. Verify email sent to supplier with fuzzy-matched items table

**Expected:** SMTP email sent to supplier with Russian template, items with confidence scores, and confirmation request

### TC4: Failed Verdict Notification
**Steps:**
1. Create Invoice with failed status and error message
2. Run dispatch_invoice_notifications with verdict="failed"
3. Check Telegram owner receives alert with error details

**Expected:** Telegram message sent with "❌ Ошибка сверки" and error context

### TC5: Non-Blocking Error Handling
**Steps:**
1. Mock Telegram send_message to raise exception
2. Mock SMTP send to return False
3. Run dispatch_invoice_notifications with verdict="verified"
4. Verify no exception raised, errors logged

**Expected:** Notification failures logged, verify_invoice_task completes without blocking

## Edge Cases Covered
- Missing TELEGRAM_OWNER_CHAT_ID → notification skipped, logged
- Invalid chat_id format → notification skipped, logged
- Supplier email missing → clarification email skipped, logged
- List truncation for >10 items → Telegram message safely truncated

## Not Proven By This UAT
- Full email → IMAP → parse → verify → notify pipeline (covered in S06)
- Real SMTP delivery to external suppliers (requires valid SMTP credentials)
- Real Telegram delivery (requires valid bot token)
