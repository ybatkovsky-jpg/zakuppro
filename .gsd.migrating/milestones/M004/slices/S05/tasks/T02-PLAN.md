---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: Add Invoice Candidate Suggestion Endpoint

Create GET /api/unresolved-transactions/{transaction_id}/candidates endpoint. Reuse PaymentMatcher logic with relaxed tolerances (10% amount, 90 days) to suggest matching invoices. Return candidates with invoice_id, supplier_name, invoice_total, amount_difference, confidence_score.

## Inputs

- `backend/routers/unresolved_transactions.py`
- `backend/services/payment_matcher.py`
- `backend/schemas.py`

## Expected Output

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py -k test_candidates -v
