# S03: Email Worker Extension + RabbitMQ Exchange — Research

## Slice Context

S03 extends the existing Email Worker to detect bank statement `.txt` attachments (1C ClientBank format) and route them to a new `bank.statement` RabbitMQ exchange. The `parse_bank_statement` Celery task processes statements using the parser from S02 and persists results to the database via BankStatement/BankTransaction models.

**Dependencies:** S02 (1C ClientBank Parser) completed; S01 (BankStatement/BankTransaction models) completed.

**Unblocks:** S04 (Auto-Matching Service) depends on persisted bank transaction data.

## Existing Infrastructure Analysis

### Email Worker (`backend/email_worker.py`)

The current email worker:
- Polls IMAP mailbox at configurable intervals (default 60s)
- Extracts PDF/Excel attachments for invoice processing
- Publishes `parse_invoice` tasks to RabbitMQ
- Tracks processed emails by Message-ID to avoid duplicates
- Uses `AttachmentExtractor.is_supported_file()` with SUPPORTED_EXTENSIONS = {'.pdf', '.xls', '.xlsx', '.xlsm'}

**Extension Point:** Modify `AttachmentExtractor.SUPPORTED_EXTENSIONS` to include `.txt` and add routing logic for bank statements.

### IMAP Client (`backend/services/imap_client.py`)

The IMAP client:
- Provides SSL/TLS connection support
- Handles connection retry with exponential backoff
- Extracts attachments via `extract_attachments()`
- Context manager pattern for connection lifecycle

**No changes needed** - the existing abstraction handles `.txt` files without modification.

### Celery App (`backend/celery_app.py`)

Current RabbitMQ setup:
- Uses `pyamqp://guest:guest@rabbitmq:5672//` broker
- DLQ configured with `dlq_exchange` (direct type)
- `default_exchange` for main queue
- `default_queue` with DLQ routing

**Extension Required:** Add new `bank_statement` exchange and queue with routing key `bank.statement`.

### Tasks (`backend/tasks.py`)

Existing patterns:
- `parse_invoice` task receives file content + metadata, calls InvoiceParser, persists to DB
- Tasks use `@app.task(bind=True, max_retries=2)` for retry configuration
- RateLimitError triggers retry with exponential backoff
- FailedTask record created for DLQ items

**New Task Needed:** `parse_bank_statement` following the same pattern as `parse_invoice`.

### Bank Statement Parser (`backend/services/bank_statement_parser.py`)

From S02:
- `parse_bank_statement_file(content: bytes)` function returns dict with:
  - `bank_name`: str
  - `statement_date`: datetime
  - `period_start`, `period_end`: datetime
  - `transactions`: List[dict] with transaction_date, amount, supplier_inn, description, operation_type
  - `raw_lines`: List[str]

**Ready to use** - output maps directly to BankStatement/BankTransaction ORM fields.

### Models (`backend/models.py`)

ORM models from S01:
```python
class BankStatement(Base):
    id, bank_name, statement_date, period_start, period_end, raw_file, status, created_at
    transactions = relationship("BankTransaction", ...)

class BankTransaction(Base):
    id, bank_statement_id, transaction_date, amount, supplier_inn, description, operation_type, created_at
```

**Ready to use** - no schema changes required.

## Implementation Landscape

### File Type Detection Strategy

**Option 1: Extension-based routing (Recommended)**
```python
SUPPORTED_EXTENSIONS = {'.pdf', '.xls', '.xlsx', '.xlsm', '.txt'}

def publish_task(filename, content, metadata):
    if filename.endswith('.txt'):
        # Likely bank statement - route to parse_bank_statement
        return publish_bank_statement_task(filename, content, metadata)
    else:
        return parse_invoice_task(filename, content, metadata)
```
- **Pros:** Simple, deterministic, no false positives
- **Cons:** Assumes all `.txt` attachments are bank statements

**Option 2: Content-based detection**
- Read first 100 bytes, check for "1CClientBank" or "СекцияДокумент" markers
- **Pros:** More accurate for mixed scenarios
- **Cons:** Over-engineered for current scope; banks only send .txt statements

**Decision:** Use Option 1 for simplicity. Add subject-line fallback later if needed.

### RabbitMQ Exchange Architecture

Current setup has `default` exchange and `dlq` exchange. New architecture adds:

```python
# Bank statement exchange (topic type for flexible routing)
bank_statement_exchange = Exchange(
    'bank.statement',
    type='topic',  # Allows bank.statement.* routing
    durable=True
)

# Bank statement queue
bank_statement_queue = Queue(
    'bank.statements',
    exchange=bank_statement_exchange,
    routing_key='bank.statement',  # Events published with this routing key
    durable=True,
    queue_arguments={
        'x-dead-letter-exchange': 'dlq',
        'x-dead-letter-routing-key': 'dlq',
    }
)
```

**Rationale:** Topic exchange allows future event types:
- `bank.statement.parsed` → successful parse
- `bank.statement.failed` → parse errors
- `bank.statement.matched` → S04 auto-matching events

### Celery Task Signature

```python
@app.task(name='tasks.parse_bank_statement', bind=True, max_retries=2)
def parse_bank_statement(self, filename: str, file_content: bytes, metadata: dict) -> dict:
    """
    Parse 1C ClientBank .txt file and persist to BankStatement/BankTransaction.
    
    Returns:
        dict with status, bank_statement_id, transactions_count
    """
```

Follows `parse_invoice` pattern exactly:
- `max_retries=2` for transient errors
- RateLimitError → exponential backoff
- FailedTask record on final failure
- Returns JSON-serializable result

### Email Worker Integration Points

**Minimal changes to `email_worker.py`:**

1. **Extension filter update** (in `imap_client.py`):
```python
class AttachmentExtractor:
    SUPPORTED_EXTENSIONS = {'.pdf', '.xls', '.xlsx', '.xlsm', '.txt'}
```

2. **Routing logic** (in `email_worker.py`):
```python
def publish_task(self, filename, content, metadata):
    if filename.endswith('.txt'):
        return self.publish_bank_statement_task(filename, content, metadata)
    else:
        return self.publish_parse_task(filename, content, metadata)
```

3. **New publish method**:
```python
def publish_bank_statement_task(self, filename, content, metadata):
    from backend.tasks import parse_bank_statement
    result = parse_bank_statement.delay(filename, content, metadata)
    logger.info(f"Published parse_bank_statement task {result.id}")
    return True
```

### Database Persistence Flow

Following `parse_invoice` pattern:

```python
# 1. Parse with BankStatementParser
parser = create_bank_statement_parser()
result = parser.parse(file_content)

# 2. Create BankStatement record
statement = BankStatement(
    bank_name=result['bank_name'],
    statement_date=result['statement_date'],
    period_start=result['period_start'],
    period_end=result['period_end'],
    raw_file=file_content,  # BLOB
    status='Обрабатывается'
)
db.add(statement)
db.commit()
db.refresh(statement)

# 3. Create BankTransaction records
for txn in result['transactions']:
    transaction = BankTransaction(
        bank_statement_id=statement.id,
        transaction_date=txn['transaction_date'],
        amount=txn['amount'],
        supplier_inn=txn['supplier_inn'],
        description=txn['description'],
        operation_type=txn['operation_type']
    )
    db.add(transaction)

db.commit()
statement.status = 'Готов'
db.commit()
```

## Error Handling & DLQ

Following established patterns:

1. **Parsing errors** (ValueError):
   - BankStatementParser raises ValueError for invalid format
   - Task creates FailedTask record
   - Goes to DLQ

2. **Transient errors** (RateLimitError, DB connection):
   - Retry with exponential backoff: `countdown = 2 ** retry_count`
   - After max_retries=2, goes to DLQ

3. **Telegram alerts**:
   - Reuse `send_dlq_alert()` from telegram_notifier
   - Alert on parse failures with filename and error message

## Integration Testing Strategy

End-to-end test verifies:
1. IMAP receives email with `.txt` attachment (Tinkoff fixture)
2. Email Worker detects `.txt` attachment
3. `parse_bank_statement` task published
4. Task processes statement, persists to DB
5. BankStatement record with status='Готов'
6. BankTransaction records count matches fixture (3 transactions)

Test fixture location: `backend/tests/fixtures/tinkoff_bank_statement.txt`

## Docker Configuration

**No changes required** - existing services have necessary configuration:
- `email-worker` service already has IMAP env vars
- `rabbitmq` service running with management UI
- `celery-worker` consumes from all configured queues

**Addition:** Update `celery_app.py` queues list to include `bank_statement_queue`.

## Observability Surfaces

Following existing email worker pattern:
- Logger statements for each stage (poll, detect, publish, process)
- Statistics tracking: emails_processed, attachments_extracted, tasks_published, errors
- Health check via `email_worker` process existence (already in docker-compose.yml)

## Known Patterns & Conventions

From prior slices:
- **MEM018**: 4 Docker services (fastapi, celery-worker, telegram-bot, rabbitmq) for isolation
- **MEM024**: Celery worker health check via `app.control.inspect().ping()`
- **MEM047**: IMAP auto-poll with Celery task publishing
- **Task pattern**: `@app.task(bind=True, max_retries=2)` with exponential backoff
- **DLQ pattern**: FailedTask record + Telegram alert for owner notification
- **SQLAlchemy patterns**: `relationship(back_populates=...)` for bidirectional navigation

## Constraints & Dependencies

- **Must use** existing `create_bank_statement_parser()` from S02
- **Must not break** existing invoice email processing
- **Must follow** Celery task patterns (retry, DLQ, logging)
- **BankStatement/BankTransaction models** are schema-locked from S01

## Open Questions (None)

All technical decisions are clear:
- File type detection: extension-based
- RabbitMQ exchange: `bank.statement` topic exchange
- Task signature: follows `parse_invoice` pattern
- Error handling: reuse DLQ + FailedTask pattern

## Don't Hand-Roll

Use existing patterns instead of reimplementing:
- **Retry logic**: Use Celery's `self.retry(exc=e, countdown=countdown)` instead of manual retry loops
- **DLQ**: Use Celery's DLQ configuration instead of custom error queues
- **Logging**: Use existing logger from email_worker instead of print statements
- **Stats**: Use existing `self.stats` dict in EmailWorker instead of new tracking

## Sources

- S02 Summary: `.gsd/migrating/milestones/M004/slices/S02/S02-SUMMARY.md`
- M004 Context: `.gsd/migrating/milestones/M004/M004-CONTEXT.md`
- Codebase: `backend/email_worker.py`, `backend/celery_app.py`, `backend/tasks.py`
- Models: `backend/models.py` (BankStatement, BankTransaction)
- Parser: `backend/services/bank_statement_parser.py`
