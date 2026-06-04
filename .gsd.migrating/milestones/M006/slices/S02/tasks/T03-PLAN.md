---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T03: Write transition guard tests and verify existing suite

Write tests for can_transition_to covering: blocks when items are К закупке, blocks when mixed statuses, allows when all На складе, allows when all Оплачено, allows mixed На складе/Оплачено. Test 422 integration via API. Verify full test suite passes.

## Inputs

- `backend/services/transition_service.py`
- `backend/routers/projects.py`

## Expected Output

- `backend/tests/test_transition_service.py`

## Verification

cd backend && python -m pytest tests/test_transition_service.py -v --tb=short && python -m pytest tests/ -v --tb=short

## Observability Impact

test coverage for all transition guard branches
