# S03: FastAPI CRUD Endpoints — UAT

**Milestone:** M001
**Written:** 2026-06-01T04:29:37.348Z

# S03: FastAPI CRUD Endpoints — UAT

**Milestone:** M001
**Written:** 2026-06-01

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: The slice delivers a REST API surface; integration tests provide automated verification of all CRUD operations, validation behavior, cascade deletes, and eager loading. Manual runtime testing would confirm the same behaviors already validated by the test suite.

## Preconditions

- PostgreSQL database is running and accessible via DATABASE_URL
- Alembic migrations have been applied (tables exist)
- Python virtual environment is activated with dependencies installed

## Smoke Test

```bash
# Start the FastAPI server
uvicorn backend.main:app --reload --port 8000

# In another terminal, verify health check
curl http://localhost:8000/health
# Expected: {"status":"ok"}

# Verify Swagger UI is accessible
curl -I http://localhost:8000/docs
# Expected: HTTP/1.1 200 OK
```

## Test Cases

### 1. Create Project via POST

1. POST to `/api/projects` with JSON body:
   ```json
   {"name": "Test Project", "client": "Test Client"}
   ```
2. **Expected:** HTTP 201 with response containing created project with `id`, `name`, `client`, `items` array, and timestamps

### 2. List Projects via GET

1. GET `/api/projects`
2. **Expected:** HTTP 200 with JSON array of projects

### 3. Get Project Detail with Eager-Loaded Items

1. Create a project with items via multiple POST calls
2. GET `/api/projects/{id}`
3. **Expected:** HTTP 200 with project object containing `items` array populated (no N+1 queries)

### 4. Update Project via PUT

1. PUT `/api/projects/{id}` with JSON body:
   ```json
   {"name": "Updated Name"}
   ```
2. **Expected:** HTTP 200 with updated project object

### 5. Delete Project with Cascade

1. DELETE `/api/projects/{id}`
2. **Expected:** HTTP 200
3. Verify cascade: GET `/api/project-items?project_id={id}` returns empty (items deleted)

### 6. Validation Error on Missing Required Field

1. POST `/api/projects` with incomplete body:
   ```json
   {"client": "Only Client"}
   ```
2. **Expected:** HTTP 422 with validation error detailing missing `name` field

### 7. Not Found Error

1. GET `/api/projects/99999` (non-existent ID)
2. **Expected:** HTTP 404 with detail message

### 8. Verify All Entity Endpoints

1. Access Swagger UI at `http://localhost:8000/docs`
2. **Expected:** All 9 entity router groups visible with 5 endpoints each (45 total): projects, project-items, suppliers, stock-items, purchase-orders, invoices, payments, unresolved-transactions, production-tasks

## Edge Cases

### Empty Database State

1. GET `/api/projects` on fresh database
2. **Expected:** HTTP 200 with empty array `[]`

### Invalid JSON in Request Body

1. POST `/api/projects` with malformed JSON
2. **Expected:** HTTP 422 validation error

## Failure Signals

- Server fails to start (import errors, missing dependencies)
- `/health` returns non-200 status
- Swagger UI returns 404 or fails to load
- Routes missing from OpenAPI schema
- Tests fail with unexpected errors
- N+1 query behavior observed in SQLAlchemy logs (multiple SELECTs for related objects)

## Not Proven By This UAT

- Authentication/authorization (not in scope for S03)
- Rate limiting or API security headers
- Production deployment configuration
- Performance under load
- WebSocket or streaming endpoints

## Notes for Tester

- The integration test suite (`backend/tests/test_api/test_projects.py`) covers all UAT scenarios automatically
- For manual testing, ensure the database is migrated: `alembic upgrade head`
- CORS is enabled for all origins in this development configuration
- All entities use the same CRUD pattern established by the Project router
