# S03: Email Worker Extension + RabbitMQ Exchange — UAT

**Milestone:** M004
**Written:** 2026-06-02T09:39:52.875Z

# S03 UAT: Bank Statement Processing Flow

## Test Cases

### 1. Tinkoff Bank Statement Processing
**Given:** An email with Tinkoff bank statement .txt attachment (1C ClientBank format)
**When:** Email Worker processes the email
**Then:**
- .txt attachment is extracted by AttachmentExtractor
- File is routed to parse_bank_statement task via bank.statement exchange
- BankStatement record created with:
  - bank_name: "TINKOFF"
  - statement_date: 02.06.2026
  - period_start: 31.05.2026
  - period_end: 02.06.2026
  - status: "Готов"
- 3 BankTransaction records created with correct amounts, INNs, descriptions
- bank_statements_processed counter incremented

### 2. Ozon Bank Statement Processing
**Given:** An email with Ozon bank statement .txt attachment
**When:** Email Worker processes the email
**Then:**
- Ozon statement processed with field variation handling (Получатель1)
- 3 BankTransaction records created
- Data persisted correctly to database

### 3. Mixed Attachments (Invoice + Bank Statement)
**Given:** An email with both PDF invoice and .txt bank statement
**When:** Email Worker processes the email
**Then:**
- PDF routed to parse_invoice task
- .txt routed to parse_bank_statement task
- Both tasks execute successfully
- Separate records created in appropriate tables

### 4. Error Handling - Parse Failure
**Given:** A .txt file with invalid 1C ClientBank format
**When:** parse_bank_statement task processes the file
**Then:**
- FailedTask record created for DLQ inspection
- Error logged appropriately
- Max retries respected (2)

## Verification Commands

```bash
# Verify RabbitMQ configuration
python -c "from backend.celery_app import app, bank_statement_exchange, bank_statement_queue; print('Exchange:', bank_statement_exchange.name); print('Queue:', bank_statement_queue.name); print('Queues:', len(app.conf.task_queues))"

# Verify .txt support
python -c "from backend.services.imap_client import AttachmentExtractor; print('Supported:', AttachmentExtractor.SUPPORTED_EXTENSIONS); print('test.txt:', AttachmentExtractor.is_supported_file('test.txt'))"

# Verify Email Worker routing
grep -q 'publish_bank_statement_task' backend/email_worker.py && grep -q '.txt' backend/email_worker.py && grep -q 'bank_statements_processed' backend/email_worker.py

# Verify parse_bank_statement task
python -c "from backend.tasks import parse_bank_statement; print('Task registered:', parse_bank_statement.name)"

# Run integration tests
pytest backend/tests/test_bank_statement_integration.py -v --tb=short
```

## Test Results

All verification checks pass:
- T01: Exchange 'bank.statement', Queue 'bank_statement', 3 task queues configured
- T02: SUPPORTED_EXTENSIONS includes '.txt', is_supported_file('test.txt') returns True
- T03: publish_bank_statement_task method exists, .txt routing implemented, stats tracking added
- T04: Task 'tasks.parse_bank_statement' registered with max_retries=2
- T05: All 6 integration tests pass (Tinkoff, Ozon, multiple statements, relationships, precision, dates)
