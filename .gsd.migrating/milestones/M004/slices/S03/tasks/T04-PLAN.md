---
estimated_steps: 20
estimated_files: 1
skills_used: []
---

# T04: Implement parse_bank_statement Celery task

## Why
Core task that processes 1C ClientBank .txt files and persists parsed data to BankStatement/BankTransaction tables.

## Do
1. In `backend/tasks.py`, add `parse_bank_statement` task with:
   - `@app.task(name='tasks.parse_bank_statement', bind=True, max_retries=2)`
   - Signature: `(filename: str, file_content: bytes, metadata: dict) -> dict`
2. Import and use `parse_bank_statement_file()` from S02 parser
3. Follow parse_invoice pattern:
   - Parse file with BankStatementParser
   - Create BankStatement record with bank_name, statement_date, period_start, period_end, raw_file, status='Обрабатывается'
   - Create BankTransaction records for each transaction
   - Update BankStatement.status to 'Готов' on success
   - Handle RateLimitError with exponential backoff
   - Create FailedTask record on final failure
4. Return dict with status, bank_statement_id, transactions_count

## Done when
- Task registered with Celery
- Processes Tinkoff/Ozon fixtures correctly
- Persists to DB without errors
- Returns correct result structure

## Inputs

- `backend/tasks.py`
- `backend/services/bank_statement_parser.py`
- `backend/models.py`

## Expected Output

- `backend/tasks.py`

## Verification

python -c "from backend.tasks import parse_bank_statement; print('Task registered:', parse_bank_statement.name)"
