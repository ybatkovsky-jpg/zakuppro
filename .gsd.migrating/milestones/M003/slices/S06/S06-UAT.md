# S06: Integration + End-to-End Testing — UAT

**Milestone:** M003
**Written:** 2026-06-02T03:18:21.101Z

# S06 UAT: End-to-End Invoice Processing Pipeline

## UAT Type
Integration Testing - Validates complete pipeline wiring without external services (IMAP/SMTP mocked)

## Preconditions
- Backend services running (FastAPI, Celery worker, RabbitMQ, PostgreSQL)
- Test database initialized with migrations
- Test fixtures available: test_invoice.xlsx, test_dirty_invoice.xlsx, test_russian_invoice.pdf
- Environment configured with mock IMAP/SMTP settings

## Test Cases

### TC1: Happy Path - Exact SKU Match
**Steps:**
1. Create Project with ProjectItems (PRD001, PRD002)
2. Call parse_invoice_task with test_invoice.xlsx (contains PRD001, PRD002)
3. Call verify_invoice_task with parsed invoice
4. Check notification dispatch

**Expected Outcomes:**
- Invoice.status = 'Сверен'
- InvoiceItem.project_item_id linked correctly
- verification_result.matched_items contains 2 items
- Telegram send_invoice_verified called with verdict='verified'

### TC2: Happy Path - Fuzzy Match
**Steps:**
1. Create Project with ProjectItem name='Widget A'
2. Parse invoice with SKU mismatch but similar name='Widget A (updated)'
3. Verify invoice

**Expected Outcomes:**
- Invoice.status = 'Требует уточнения'
- verification_result.fuzzy_matched_items populated with name_similarity >85
- Telegram notification dispatched for clarification

### TC3: Error Path - LLM Parse Failure
**Steps:**
1. Mock LLM provider to raise LLMRateLimitError
2. Call parse_invoice_task

**Expected Outcomes:**
- Exception propagates for Celery retry
- No Invoice record created
- No notification dispatched

### TC4: Error Path - Notification Failure (Non-blocking)
**Steps:**
1. Parse and verify invoice successfully
2. Mock telegram_notifier.send_invoice_verified to raise RuntimeError
3. Call dispatch_invoice_notifications

**Expected Outcomes:**
- Task completes successfully (no exception raised)
- Invoice.status = 'Сверен' (verification persisted)
- Notification failure logged without blocking

### TC5: Dirty Fixture - Russian Content
**Steps:**
1. Parse test_russian_invoice.pdf (contains Russian headers: Артикул, Наименование, Кол-во)
2. Verify invoice
3. Dispatch notification

**Expected Outcomes:**
- InvoiceItem.name contains Cyrillic characters (Болт М10 ст3)
- UTF-8 encoding preserved through pipeline
- Telegram notification sent with Russian content

## Not Proven By This UAT
- Actual IMAP email ingestion (external service mocked in tests)
- Actual SMTP email sending (external service mocked in tests)
- Real Telegram API calls (mocked in tests)
- Celery retry behavior with actual RabbitMQ
- Production LLM API calls (mocked in tests)
