---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T05: Add Audit History Endpoint and Extend TransactionMatchingAudit

Add unresolved_transaction_id nullable FK to TransactionMatchingAudit model (migration not needed - DB is ephemeral in tests). Create GET /api/unresolved-transactions/audit-history endpoint with filters (transaction_id, invoice_id, date_from/to, matched_by). Return audit records with nested Invoice/BankTransaction/UnresolvedTransaction details.

## Inputs

- `backend/models.py`
- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`

## Expected Output

- `backend/models.py`
- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py -k test_audit_history -v
