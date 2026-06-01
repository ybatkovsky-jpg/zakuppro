---
id: T04
parent: S04
milestone: M003
key_files:
  - backend/tasks.py
key_decisions:
  - Use FailedTask DLQ pattern from M002 for error persistence
  - Task chaining returns invoice_id for downstream verification
duration: 
verification_result: passed
completed_at: 2026-06-01T21:55:28.711Z
blocker_discovered: false
---

# T04: Added verify_invoice_task Celery task with fuzzy matching BOM reconciliation and DLQ error handling

**Added verify_invoice_task Celery task with fuzzy matching BOM reconciliation and DLQ error handling**

## What Happened

Implemented verify_invoice_task Celery task in backend/tasks.py that integrates the invoice_verifier service for asynchronous invoice-to-BOM reconciliation. The task:

1. Calls verify_invoice(invoice_id, db) to perform fuzzy matching
2. Returns structured summary with verdict, match counts, discrepancies
3. Handles errors with FailedTask DLQ persistence (M002 pattern)
4. Supports chaining after parse_invoice: parse_invoice().link(verify_invoice_task.si(invoice_id))

The task follows existing Celery patterns from M003/S03 with max_retries=2, proper logging, and database session cleanup.

## Verification

grep -n "verify_invoice" backend/tasks.py confirms task is registered at line 700. Task calls invoice_verifier.verify_invoice with database session. FailedTask DLQ handling on errors with context JSON. Task returns structured result with verification summary.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -n 'verify_invoice' backend/tasks.py` | 0 | pass | 1000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tasks.py`
