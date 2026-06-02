---
estimated_steps: 13
estimated_files: 1
skills_used: []
---

# T03: Add routing logic to Email Worker for .txt files

## Why
Email Worker needs to distinguish between invoice attachments (PDF/Excel) and bank statements (.txt) and route them to appropriate Celery tasks.

## Do
1. In `backend/email_worker.py`, add `publish_bank_statement_task()` method following the pattern of `publish_parse_task()`
2. Import `parse_bank_statement` task (will be added in T04)
3. Update `process_email()` attachment loop to check file extension:
   - If `.txt` → call `publish_bank_statement_task()`
   - Otherwise → call `publish_parse_task()`
4. Add 'bank_statements_processed' to self.stats

## Done when
- publish_bank_statement_task() method exists
- Attachment routing logic distinguishes .txt from other files
- Stats tracking includes bank statements

## Inputs

- `backend/email_worker.py`

## Expected Output

- `backend/email_worker.py`

## Verification

grep -q 'publish_bank_statement_task' backend/email_worker.py && grep -q '.txt' backend/email_worker.py && grep -q 'bank_statements_processed' backend/email_worker.py
