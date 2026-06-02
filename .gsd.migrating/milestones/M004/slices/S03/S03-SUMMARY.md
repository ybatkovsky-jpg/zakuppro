---
id: S03
parent: M004
milestone: M004
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - ["backend/celery_app.py", "backend/services/imap_client.py", "backend/email_worker.py", "backend/tasks.py", "backend/tests/test_bank_statement_integration.py", "backend/tests/test_parse_bank_statement_task.py", "backend/tests/test_email_worker.py", "backend/tests/test_imap_client.py"]
key_decisions:
  - ["Followed existing pattern from default_exchange/dlq_exchange for bank.statement configuration", "Used topic exchange type to support future event types (bank.statement.parsed, bank.statement.failed)", "Added .txt to SUPPORTED_EXTENSIONS rather than creating separate bank-specific extractor", "Applied case-insensitive extension checking (.txt and .TXT both supported)", "Implemented parse_bank_statement with same retry/backoff pattern as parse_invoice for consistency", "Created comprehensive integration tests covering both Tinkoff and Ozon fixtures"]
patterns_established:
  - ["Celery task pattern: bind=True for self.request access, max_retries=2 for retry logic", "Bank statement processing: status transition Обрабатывается → Готов", "FailedTask DLQ pattern for inspecting failed messages", "Stats tracking pattern: tasks_published and bank_statements_processed counters"]
observability_surfaces:
  - ["Logger statements for each stage (detect, publish, process, persist)", "Statistics tracking: bank_statements_processed, parse_errors", "FailedTask records on parse failures for DLQ inspection", "print_stats() method displays bank_statements_processed counter"]
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-06-02T09:39:52.873Z
blocker_discovered: false
---

# S03: Email Worker Extension + RabbitMQ Exchange

**Extended Email Worker to detect and route .txt bank statement attachments to parse_bank_statement Celery task with full persistence to BankStatement/BankTransaction models**

## What Happened

Implemented complete bank statement processing pipeline from IMAP to database:

**T01 - RabbitMQ Configuration:**
- Added bank_statement_exchange (topic type, durable=True) to celery_app.py
- Added bank_statement_queue with routing_key='bank.statement' and DLQ binding
- Configured task routing for 'tasks.parse_bank_statement' → 'bank_statement' queue
- Total queues: default, bank_statement, dlq (3)

**T02 - AttachmentExtractor Extension:**
- Added '.txt' to SUPPORTED_EXTENSIONS in imap_client.py
- Enabled extraction of 1C ClientBank format files from emails
- Updated tests to verify .txt support (36 tests passing)

**T03 - Email Worker Routing:**
- Added publish_bank_statement_task() method following existing pattern
- Updated process_email() to route .txt files to bank statement task, PDF/Excel to invoice parsing
- Added 'bank_statements_processed' stats tracking
- Added 5 new tests (29 total tests passing)

**T04 - Parse Bank Statement Task:**
- Implemented parse_bank_statement Celery task with max_retries=2
- Processes 1C ClientBank .txt files using S02's BankStatementParser
- Creates BankStatement (status: Обрабатывается → Готов) and BankTransaction records
- Handles RateLimitError with exponential backoff, creates FailedTask on final failure
- Returns dict with status, bank_statement_id, transactions_count, bank_name, period dates
- Added 8 comprehensive tests (all passing)

**T05 - Integration Tests:**
- Created test_bank_statement_integration.py with 6 tests
- Validates end-to-end flow from fixture to DB persistence
- Verifies transaction counts, amounts, INNs, descriptions, status transitions
- Tests multiple statements, ORM relationships, Decimal precision, date ranges
- All 6 integration tests passing

**Verification:**
- All 5 tasks verified and completed
- Logger statements added for each stage
- Statistics tracking implemented (bank_statements_processed, parse_errors)
- FailedTask records created on parse failures
- Ready to unblock S04 (Auto-Matching Service)

## Verification

- T01: RabbitMQ exchange/queue configured, module imports successfully, task routing verified
- T02: .txt extension support verified with 36 tests passing
- T03: Email Worker routing logic verified with 29 tests passing, grep checks pass
- T04: parse_bank_statement task registered, 8 unit tests pass, processes Tinkoff/Ozon fixtures
- T05: 6 integration tests pass validating end-to-end flow from fixture to DB persistence

## Requirements Advanced

- R001 — Email Worker .txt routing and parse_bank_statement task implemented
- R002 — BankStatementParser from S02 integrated with Celery task

## Requirements Validated

- R003 — Integration tests verify end-to-end flow with Tinkoff and Ozon fixtures, 6 tests pass

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

None.
