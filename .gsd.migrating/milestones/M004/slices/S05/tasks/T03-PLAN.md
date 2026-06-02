---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T03: Add Single Manual Match Endpoint

Create POST /api/unresolved-transactions/{transaction_id}/match endpoint. Validate unresolved transaction exists with status 'Не распределено', validate invoice exists, create Payment record, create TransactionMatchingAudit with matched_by='manual', update UnresolvedTransaction.status to 'Привязано вручную'. Use database transaction with rollback on failure.

## Inputs

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/models.py`
- `backend/services/payment_matcher.py`

## Expected Output

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/models.py`

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py -k test_single_match -v
