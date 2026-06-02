---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T06: Write API Unit Tests

Create backend/tests/test_api/test_unresolved_transactions.py with test classes for each endpoint group. Test filters (status, amount range, date range, description search, ordering). Test candidate suggestions with different tolerances. Test single match (success, 404 on invalid, status update). Test bulk match (all success, partial failure rollback). Test audit history (filters, nested data). Use test_client fixture from conftest.py.bak pattern.

## Inputs

- `backend/tests/conftest.py.bak`
- `backend/tests/test_api/test_projects.py`

## Expected Output

- `backend/tests/test_api/test_unresolved_transactions.py`

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py -v
