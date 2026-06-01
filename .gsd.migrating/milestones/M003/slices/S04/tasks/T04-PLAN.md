---
estimated_steps: 15
estimated_files: 1
skills_used: []
---

# T04: Add verify_invoice Celery task

## Why
Celery task enables asynchronous verification after invoice parsing, integrating into the parse_invoice → verify_invoice pipeline.

## Do
1. Add `verify_invoice_task` to `backend/tasks.py`:
   - Signature: `verify_invoice_task(self, invoice_id: int) -> dict`
   - Calls `invoice_verifier.verify_invoice(invoice_id, db)`
   - Returns dict with status, invoice_id, verification_summary
   - Uses FailedTask DLQ pattern from existing tasks on error
2. Wire task chaining: modify `parse_invoice` task to return invoice_id for chaining
   - Document that verification should be triggered after parse_invoice completes

## Done when
- `verify_invoice_task` registered in `backend/tasks.py`
- Task calls invoice_verifier.verify_invoice with database session
- FailedTask DLQ handling on errors (reuses M002 pattern)
- Task returns structured result with verification summary

## Inputs

- `backend/tasks.py`
- `backend/services/invoice_verifier.py`

## Expected Output

- `backend/tasks.py`

## Verification

grep -n "verify_invoice" backend/tasks.py

## Observability Impact

Async verification task fits existing Celery infrastructure with DLQ error handling
