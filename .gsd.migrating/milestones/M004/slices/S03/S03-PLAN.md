# S03: Email Worker Extension + RabbitMQ Exchange

**Goal:** Extend Email Worker to detect bank statement .txt attachments (1C ClientBank format) and route them to a new parse_bank_statement Celery task that persists parsed statements to BankStatement/BankTransaction models.
**Demo:** Email Worker detects .txt attachments, routes to bank.statement exchange. parse_bank_statement Celery task processes statement and persists to DB. Integration test verifies end-to-end flow.

## Must-Haves

- Email Worker AttachmentExtractor supports .txt files
- Bank statement exchange and queue configured in Celery
- parse_bank_statement task processes statements and persists to DB
- Integration test verifies end-to-end flow from IMAP to DB

## Proof Level

- This slice proves: integration

## Integration Closure

Unblocks S04 (Auto-Matching Service) which requires persisted bank transaction data with INN for auto-linking to invoices.

## Verification

- Logger statements for each stage (detect, publish, process, persist). Statistics tracking: bank_statements_processed, parse_errors. FailedTask records on parse failures.

## Tasks

- [x] **T01: Configure RabbitMQ bank.statement exchange and queue** `est:20m`
  ## Why
  RabbitMQ needs a dedicated exchange and queue for bank statement processing. This isolates bank statement traffic from invoice processing and allows independent scaling and monitoring.
  - Files: `backend/celery_app.py`
  - Verify: python -c "from backend.celery_app import app, bank_statement_exchange, bank_statement_queue; print('Exchange:', bank_statement_exchange.name); print('Queue:', bank_statement_queue.name); print('Queues:', len(app.conf.task_queues))"

- [x] **T02: Add .txt support to AttachmentExtractor** `est:10m`
  ## Why
  The IMAP client's AttachmentExtractor currently only supports .pdf, .xls, .xlsx, .xlsm files. Bank statements use .txt extension (1C ClientBank format).
  - Files: `backend/services/imap_client.py`
  - Verify: python -c "from backend.services.imap_client import AttachmentExtractor; print('Supported:', AttachmentExtractor.SUPPORTED_EXTENSIONS); print('test.txt:', AttachmentExtractor.is_supported_file('test.txt'))"

- [x] **T03: Add routing logic to Email Worker for .txt files** `est:30m`
  ## Why
  Email Worker needs to distinguish between invoice attachments (PDF/Excel) and bank statements (.txt) and route them to appropriate Celery tasks.
  - Files: `backend/email_worker.py`
  - Verify: grep -q 'publish_bank_statement_task' backend/email_worker.py && grep -q '.txt' backend/email_worker.py && grep -q 'bank_statements_processed' backend/email_worker.py

- [x] **T04: Implement parse_bank_statement Celery task** `est:45m`
  ## Why
  Core task that processes 1C ClientBank .txt files and persists parsed data to BankStatement/BankTransaction tables.
  - Files: `backend/tasks.py`
  - Verify: python -c "from backend.tasks import parse_bank_statement; print('Task registered:', parse_bank_statement.name)"

- [x] **T05: Write integration test for end-to-end bank statement flow** `est:30m`
  ## Why
  Verify the complete flow: IMAP receives email with .txt attachment → Email Worker routes to parse_bank_statement → Task processes → Data persisted to DB.
  - Files: `backend/tests/test_bank_statement_integration.py`
  - Verify: pytest backend/tests/test_bank_statement_integration.py -v --tb=short

## Files Likely Touched

- backend/celery_app.py
- backend/services/imap_client.py
- backend/email_worker.py
- backend/tasks.py
- backend/tests/test_bank_statement_integration.py
