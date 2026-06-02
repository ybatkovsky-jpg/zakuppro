---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Add Filter and Search to UnresolvedTransaction List Endpoint

Extend GET /api/unresolved-transactions with query parameters for filtering (status, amount_min/max, date_from/to, description search) and ordering (order_by, order_dir). Build SQLAlchemy query dynamically based on provided filters. Return paginated results.

## Inputs

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/models.py`

## Expected Output

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py -k test_list -v
