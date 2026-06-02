---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T04: Add Bulk Manual Match Endpoint

Create POST /api/unresolved-transactions/bulk-match endpoint accepting list of (unresolved_transaction_id, invoice_id, optional amount). Validate all inputs, wrap in database transaction, create Payment and TransactionMatchingAudit records for each match, update UnresolvedTransaction statuses. Return summary with matched_count, failed_count, payment_ids, errors. Rollback entire transaction on any failure.

## Inputs

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/models.py`

## Expected Output

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py -k test_bulk_match -v
