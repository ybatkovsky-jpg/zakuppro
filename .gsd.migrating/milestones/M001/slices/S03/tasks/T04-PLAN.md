---
estimated_steps: 25
estimated_files: 3
skills_used: []
---

# T04: Write API integration tests

## Why
Verify CRUD operations work end-to-end with real database. Tests catch regressions and serve as documentation for API contract.

## Do
1. Create `backend/tests/test_api/__init__.py`
2. Create `backend/tests/test_api/test_projects.py`:
   - test_create_project: POST returns 200 with id
   - test_get_project: GET returns project with items
   - test_get_project_not_found: returns 404
   - test_update_project: PUT modifies fields
   - test_delete_project: DELETE removes project
   - test_delete_project_cascade: items also deleted
   - test_create_project_validation: 422 on invalid input
3. Create `backend/tests/conftest.py` with:
   - TestClient fixture using FastAPI app
   - db_session fixture (reuse from test_models.py)
   - Test database setup/teardown

## Constraints
- Use TestClient from fastapi.testclient
- Use SQLite in-memory for test speed
- Verify eager loading (items included in response)
- Check status codes exactly (200, 404, 422)

## Done when
test_projects.py has 7+ tests
All tests pass: `pytest backend/tests/test_api/ -v`
Coverage includes success and error paths

## Inputs

- `backend/main.py`
- `backend/routers/projects.py`
- `backend/models.py`
- `backend/schemas.py`
- `backend/tests/test_models.py`

## Expected Output

- `backend/tests/test_api/__init__.py`
- `backend/tests/test_api/test_projects.py`
- `backend/tests/conftest.py`

## Verification

pytest backend/tests/test_api/test_projects.py -v --tb=short

## Observability Impact

Tests verify API contract and cascade behavior; pytest output shows pass/fail for each endpoint.
