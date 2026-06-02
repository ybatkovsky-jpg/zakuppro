---
id: T04
parent: S03
milestone: M004
key_files:
  - backend/tasks.py
  - backend/tests/test_parse_bank_statement_task.py
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-02T09:34:09.822Z
blocker_discovered: false
---

# T04: Implemented parse_bank_statement Celery task for processing 1C ClientBank .txt files with full persistence and error handling

**Implemented parse_bank_statement Celery task for processing 1C ClientBank .txt files with full persistence and error handling**

## What Happened

## Implementation Summary

Created `parse_bank_statement` Celery task in `backend/tasks.py` that processes 1C ClientBank .txt bank statement files from email attachments.

### Task Implementation
- Decorator: `@app.task(name='tasks.parse_bank_statement', bind=True, max_retries=2)`
- Signature: `(filename: str, file_content: bytes, metadata: dict) -> dict`
- Imports and uses `parse_bank_statement_file()` from S02 BankStatementParser service
- Follows the established `parse_invoice` pattern for consistency

### Processing Pipeline
1. Parses .txt file with BankStatementParser (CP1251/UTF-8 encoding support)
2. Creates BankStatement record with bank_name, dates, raw_file (BLOB), status='Обрабатывается'
3. Creates BankTransaction records for each extracted transaction
4. Updates BankStatement.status to 'Готов' on success
5. Handles RateLimitError with exponential backoff (2^n seconds for retry n)
6. Creates FailedTask record on final failure for DLQ inspection

### Result Structure
Returns dict with:
- status: 'success' or 'error'
- filename: Processed filename
- bank_statement_id: ID of created BankStatement record
- transactions_count: Number of BankTransaction records created
- bank_name: Extracted bank name (e.g., 'TINKOFF', 'OZON')
- period_start/end: Statement period dates
- message_id: Email Message-ID from metadata
- task_id: Celery task ID

### Testing
Created comprehensive test suite in `backend/tests/test_parse_bank_statement_task.py` with 8 tests covering:
- Tinkoff and Ozon fixture parsing and persistence
- Multiple statements creating separate records
- Empty/invalid statement error handling
- FailedTask DLQ creation on errors
- RateLimitError retry with exponential backoff
- Status transitions from Обрабатывается to Готов
- Transaction data integrity validation

All 8 tests pass successfully using in-memory SQLite database.

### Files Modified
- `backend/tasks.py`: Added parse_bank_statement task (~150 lines)

### Files Created
- `backend/tests/test_parse_bank_statement_task.py`: Comprehensive test suite (~320 lines)

## Verification

## Verification Evidence

| Command | Exit Code | Verdict | Duration |
|---------|-----------|---------|----------|
| `python -c "from backend.tasks import parse_bank_statement; print('Task registered:', parse_bank_statement.name)"` | 0 | PASS | ~1s |
| `python -m pytest backend/tests/test_parse_bank_statement_task.py -v` | 0 | PASS (8/8) | ~3s |

### Tests Passing
1. test_tinkoff_statement_parsing_and_persistence - PASSED
2. test_ozon_statement_parsing_and_persistence - PASSED
3. test_multiple_statements_create_separate_records - PASSED
4. test_empty_statement_raises_value_error - PASSED
5. test_invalid_format_creates_failed_task - PASSED
6. test_rate_limit_retries_with_backoff - PASSED
7. test_status_transitions_correctly - PASSED
8. test_transaction_data_integrity - PASSED

### Task Registration Verified
- Task name: `tasks.parse_bank_statement`
- Max retries: 2
- Registered with Celery app successfully

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -c "from backend.tasks import parse_bank_statement; print('Task registered:', parse_bank_statement.name)"` | 0 | PASS | 1000ms |
| 2 | `python -m pytest backend/tests/test_parse_bank_statement_task.py -v` | 0 | PASS (8/8 tests) | 3000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tasks.py`
- `backend/tests/test_parse_bank_statement_task.py`
