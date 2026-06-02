---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T08: Restore test_client Fixture and Run Full Test Suite

Copy test_client fixture from conftest.py.bak to active conftest.py. Ensure all API tests can run with TestClient. Run full test suite for unresolved_transactions to verify all endpoints work together. Fix any missing imports or dependency issues.

## Inputs

- `backend/tests/conftest.py.bak`
- `backend/tests/conftest.py`

## Expected Output

- `backend/tests/conftest.py`

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py backend/tests/test_unresolved_matching_integration.py -v
