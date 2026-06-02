# S05 Research: Notifications + Clarification Flow

## Summary

Slice S05 requires building notification infrastructure for invoice verification outcomes and implementing a clarification flow for supplier interactions. Research reveals existing patterns for Telegram notifications (telegram_notifier.py) and email polling (email_worker.py), but key components are missing: no email sending capability, no invoice-specific notification functions, and no conversation state mechanism for the clarification workflow.

**Key Finding**: The project already has aiosmtplib==3.0.2 in requirements and SMTP credentials configured in .env. This is an extension task building on S04's verification service, not greenfield infrastructure.

**Surprise**: Despite having a telegram_bot.py with handlers/, the bot lacks ConversationHandler patterns needed for interactive clarification flows. Current handlers are simple command/message responses only.

## Recommendation

Build in three phases:
1. **Extend telegram_notifier.py** with invoice-specific notification functions (3 outcomes: success, partial, clarification_needed)
2. **Create email_notifier.py** using aiosmtplib for SMTP clarification emails to suppliers
3. **Add conversation state** to Telegram bot for interactive owner confirmation workflow

The verification verdicts from S04 drive notification routing:
- `verified` → Telegram success message to owner
- `partial` → Telegram warning with discrepancy details
- `clarification_needed` → Email supplier + Telegram alert to owner
- `failed` → Telegram critical alert

## Implementation Landscape

### What Exists

1. **Telegram Notification Pattern** (backend/telegram_notifier.py)
   - `send_completion_message(chat_id, project_name, items_count, reserved_count)` → bool
   - `send_dlq_alert(chat_id, failed_task)` → bool
   - Uses `_get_bot()` helper that initializes Bot from TELEGRAM_BOT_TOKEN
   - Returns `False` on failure (non-critical pattern per MEM037)
   - Logs errors with logger.exception()

2. **Email Worker Pattern** (backend/email_worker.py)
   - `EmailWorker` class with `poll_forever()` method
   - Graceful shutdown with `shutdown_event` and SIGTERM handling
   - Statistics tracking (processed_count, error_count, last_email_time)
   - Pattern: long-running service with periodic polling

3. **Verification Result Structure** (backend/schemas/verification.py)
   - `VerificationResult` stored in `Invoice.verification_result` (JSONB)
   - Contains verdict, matched_items, fuzzy_matched_items, unmapped_items, quantity_discrepancies
   - `ItemVerification` per-item: invoice_item_id, project_item_id, match_type, name_similarity
   - `QuantityDiscrepancy`: invoice_qty, expected_qty, discrepancy

4. **Celery Task Pattern** (backend/tasks.py:700-835)
   - `verify_invoice_task(invoice_id)` returns structured dict:
     ```python
     {
         'status': 'success',
         'invoice_id': invoice_id,
         'verdict': verdict,
         'matched_count': matched_count,
         'fuzzy_count': fuzzy_count,
         'unmapped_count': unmapped_count,
         'discrepancies': discrepancies,
         'extra_items': extra_count,
         'missing_items': missing_count,
     }
     ```

5. **SMTP Credentials** (.env:35-48)
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_EMAIL=your_email@gmail.com`
   - `SMTP_PASSWORD=your_app_password`
   - Already configured for Gmail SMTP

6. **Dependencies**
   - `aiosmtplib==3.0.2` — async SMTP client (already in requirements.txt)
   - `python-telegram-bot==21.10` — Telegram bot library
   - `celery==5.4.0` — task queue for async notification dispatch

### What Is Missing

1. **Email Sending Capability**
   - No `email_notifier.py` or equivalent for outbound SMTP
   - Need async function: `send_clarification_email(supplier_email, invoice_data, unmatched_items)`
   - Need email template for clarification request

2. **Invoice-Specific Telegram Notifications**
   - `telegram_notifier.py` has generic completion messages only
   - Need invoice-specific functions:
     - `send_invoice_verified(chat_id, invoice_id, stats)`
     - `send_invoice_partial(chat_id, invoice_id, discrepancies)`
     - `send_invoice_clarification_needed(chat_id, invoice_id, fuzzy_matches)`

3. **Conversation State Mechanism**
   - `telegram_bot.py` has no `ConversationHandler`
   - Need state management for:
     - Owner confirmation after supplier responds
     - Variation alias selection for new SKUs
   - Current handlers/commands.py has simple command/message handlers only

4. **Variation Alias Storage**
   - No schema or model identified for storing variation aliases
   - Need to define where alias data goes after clarification

5. **Clarification Workflow Integration**
   - No linking between email responses and invoice records
   - Need token/confirmation mechanism for supplier responses

## Constraints

1. **Architectural Decision (MEM049)**
   - SMTP for supplier communications (not Telegram)
   - Telegram for owner notifications only
   - Cannot route supplier notifications to Telegram

2. **Existing Bot Structure**
   - `telegram_bot.py` uses `Application.builder().token(...)`
   - Handlers registered via `application.add_handler()`
   - Must add ConversationHandler without breaking existing command handlers

3. **Non-Critical Notifications (MEM037)**
   - Telegram functions return `bool` on failure
   - Notification failures do not block invoice processing
   - Errors logged but not raised

4. **Celery Task Integration**
   - Notifications must integrate with `verify_invoice_task` workflow
   - Task returns structured result; notification dispatch happens after

## Key Files

| File | Purpose | Touch |
|------|---------|-------|
| `backend/telegram_notifier.py` | Existing Telegram notification patterns | Extend |
| `backend/email_notifier.py` | **NEW** SMTP clarification emails | Create |
| `backend/telegram_bot.py` | Main bot entry point | Modify |
| `backend/handlers/clarification.py` | **NEW** ConversationHandler for confirmation workflow | Create |
| `backend/tasks.py` | Celery task integration point | Modify |
| `backend/models.py` | Potential variation alias schema | TBD |
| `backend/schemas/verification.py` | Verification result structure | Reference |
| `backend/services/invoice_verifier.py` | Verdict determination logic | Reference |

## Build Order

1. **Phase 1: Telegram Notifications** (2-3 functions)
   - Extend `telegram_notifier.py` with invoice-specific notification functions
   - Add `send_invoice_verified()`, `send_invoice_partial()`, `send_invoice_clarification_needed()`
   - Integrate into `verify_invoice_task` success handler

2. **Phase 2: Email Notifier** (1 new file)
   - Create `backend/email_notifier.py` with async SMTP client
   - Implement `send_clarification_email()` using aiosmtplib
   - Add email template for clarification request

3. **Phase 3: Conversation State** (1-2 new files)
   - Add ConversationHandler to `telegram_bot.py`
   - Create `backend/handlers/clarification.py` for owner confirmation flow
   - Implement state machine: AWAITING_CONFIRMATION → CONFIRMED/REJECTED

## First Proof

Send notification after invoice verification:
1. Call `verify_invoice_task(invoice_id)` → returns verdict
2. Route to notification function based on verdict:
   - `verified` → `send_invoice_verified(TELEGRAM_OWNER_CHAT_ID, ...)`
   - `clarification_needed` → `send_clarification_email(supplier_email, ...)` + `send_invoice_clarification_needed(...)`
3. Verify Telegram message appears in owner chat
4. Verify email received by supplier (for clarification_needed verdict)

## Verification

```bash
# 1. Unit tests for notification functions
pytest backend/tests/test_notifications.py -v

# 2. Integration test: verify_invoice → notification dispatch
pytest backend/tests/test_s05_notifications_integration.py -v

# 3. Manual verification:
# - Create invoice with clarification_needed verdict
# - Check owner Telegram receives alert
# - Check supplier email receives clarification request
# - Respond to email → verify conversation state activates
```

## Dependencies

- **Requires**: S04 completion (invoice verification with fuzzy matching)
- **Blocks**: S06 (if S06 depends on clarification workflow completion)
- **External**: SMTP server (Gmail), Telegram Bot API

## Risks

1. **Conversation State Complexity** — Adding ConversationHandler may conflict with existing command handlers
2. **Email Delivery** — Gmail SMTP may require app-specific password; rate limits apply
3. **Async Coordination** — Celery task completion → notification dispatch timing
4. **Schema Unknown** — Variation alias storage model not yet identified