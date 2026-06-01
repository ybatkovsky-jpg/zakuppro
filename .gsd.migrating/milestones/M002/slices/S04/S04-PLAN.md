# S04: Project Creation + DLQ

**Goal:** Complete end-to-end BOM upload flow: Excel from Telegram → parse with AI → create Project/ProjectItem in DB → send Telegram response. Implement DLQ persistence with FailedTask model and Telegram alerts for failed tasks.
**Demo:** End-to-end: Excel из Telegram → Project в БД → ответ в Telegram со статистикой. DLQ работает при ошибках.

## Must-Haves

- Upload Excel via Telegram → Project created in DB with ProjectItems
- Failed tasks logged to failed_tasks table with context
- Telegram user receives completion message with statistics
- Telegram owner receives alert when task fails to DLQ
- Supplier names auto-resolved to supplier_id with placeholder email fallback

## Proof Level

- This slice proves: integration

## Integration Closure

- Upstream consumed: Telegram Bot (S02), parse_excel_bom task (S03), RabbitMQ infrastructure (S01)
- New wiring: process_bom_to_project task orchestrates full flow, FailedTask model for DLQ persistence, telegram_notifier for outbound messages
- What remains: Nothing — M002 end-to-end flow is complete after this slice

## Verification

- Logs: Task start with file_path and chat_id, supplier creation events, Project/ProjectItem creation counts, Telegram send results, error details with traceback
- Inspection: failed_tasks table for DLQ context, Celery task results via AsyncResult, Telegram message history
- Failure state: FailedTask record preserves task_id, error_message, file_path, chat_id, JSON context; Telegram alert sent to owner

## Tasks

- [x] **T01: Create FailedTask Model and Database Migration** `est:30m`
  ## Why
  DLQ context persistence (R005) requires a database table to store failed task details including task_id, error message, file_path, chat_id, and JSON context for debugging and manual reprocessing.
  - Files: `backend/models.py`, `backend/alembic/versions/*.py`
  - Verify: python -c "from backend.models import FailedTask; print('FailedTask imported successfully')"

- [ ] **T02: Create Supplier Resolver Module** `est:20m`
  ## Why
  AI extraction returns supplier names (strings), but ProjectItem requires supplier_id (integer). This module bridges the gap by finding existing suppliers or auto-creating them with placeholder email addresses.
  - Files: `backend/supplier_resolver.py`
  - Verify: python -c "from backend.supplier_resolver import find_or_create_supplier; print('Module imported successfully')"

- [ ] **T03: Create Telegram Notification Helper** `est:20m`
  ## Why
  Celery tasks need to send outbound messages to Telegram users (completion notifications) and owner (DLQ alerts). Existing handlers only reply to inbound messages.
  - Files: `backend/telegram_notifier.py`
  - Verify: python -c "from backend.telegram_notifier import send_completion_message, send_dlq_alert; print('Module imported successfully')"

- [ ] **T04: Implement Main Orchestration Task** `est:1h`
  ## Why
  The end-to-end flow (R004) requires a Celery task that chains Excel parsing, database operations, and Telegram notifications. This is the core integration piece.
  - Files: `backend/tasks.py`
  - Verify: grep -q 'process_bom_to_project' backend/tasks.py

- [ ] **T05: Wire Orchestration Task into Upload Flow** `est:20m`
  ## Why
  The upload handler currently calls queue_excel_processing which only validates files. It should call the new orchestration task to trigger the full end-to-end flow.
  - Files: `backend/tasks.py`, `backend/handlers/documents.py`
  - Verify: grep -q 'process_bom_to_project' backend/handlers/documents.py || grep -q 'parse_excel_bom.delay' backend/tasks.py

- [ ] **T06: Write End-to-End Integration Test** `est:40m`
  ## Why
  Verification of the complete flow (R004, R005) requires an integration test that exercises Excel upload through database creation to Telegram notification.
  - Files: `backend/tests/test_s04_integration.py`
  - Verify: python -m pytest backend/tests/test_s04_integration.py -v

## Files Likely Touched

- backend/models.py
- backend/alembic/versions/*.py
- backend/supplier_resolver.py
- backend/telegram_notifier.py
- backend/tasks.py
- backend/handlers/documents.py
- backend/tests/test_s04_integration.py
