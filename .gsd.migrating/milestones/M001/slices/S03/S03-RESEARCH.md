# M001-S03 — FastAPI CRUD Endpoints

**Date:** 2026-06-01

## Summary

Slice S03 will create a FastAPI application with CRUD endpoints for all 9 entities (Project, ProjectItem, Supplier, StockItem, PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask). The SQLAlchemy models and Pydantic schemas from S02 are complete and tested. This slice needs to create a new `backend/main.py` with the FastAPI app, router modules for each entity's CRUD operations, and basic health check endpoint. The dependency injection pattern using `get_db()` from `database.py` is already available.

**Primary recommendation:** Create a modular FastAPI app with `backend/main.py` as the entry point, separate router files per entity (e.g., `backend/routers/projects.py`) to keep code organized, use standard CRUD endpoint patterns (GET list, GET detail, POST create, PUT update, DELETE delete), leverage existing Pydantic schemas for request/response validation, and add a `/health` endpoint for readiness checks.

## Recommendation

**Approach:** Create FastAPI application with modular routers for each entity, following standard CRUD conventions.

**Why:**
- FastAPI 0.115.0 and uvicorn 0.32.0 are already in `requirements.txt`
- Pydantic v2 schemas from S02 provide ready-to-use request/response models
- SQLAlchemy models with `lazy="selectin"` relationships are optimized for the common query patterns
- Modular routers (one file per entity) keep code maintainable as the API grows
- Using `get_db()` dependency from `database.py` ensures proper session management

## Implementation Landscape

### Key Files

- **`backend/main.py`** — New file. FastAPI application entry point. Will:
  - Create `FastAPI()` instance with title, description, version
  - Include routers for each entity
  - Add `/health` endpoint for health checks
  - Configure CORS if needed (can be deferred to later slice)

- **`backend/routers/__init__.py`** — New package marker.

- **`backend/routers/projects.py`** — New router for Project CRUD. Example pattern:
  ```python
  GET  /api/projects/        — List all projects (with optional pagination/filtering)
  GET  /api/projects/{id}    — Get single project with items
  POST /api/projects/        — Create project
  PUT  /api/projects/{id}    — Update project
  DELETE /api/projects/{id}   — Delete project (cascade deletes items)
  ```

- **`backend/routers/`** — Additional routers following same pattern:
  - `project_items.py` — ProjectItem CRUD
  - `suppliers.py` — Supplier CRUD
  - `stock_items.py` — StockItem CRUD
  - `purchase_orders.py` — PurchaseOrder CRUD
  - `invoices.py` — Invoice CRUD
  - `payments.py` — Payment CRUD
  - `unresolved_transactions.py` — UnresolvedTransaction CRUD
  - `production_tasks.py` — ProductionTask CRUD

- **`backend/routers/health.py`** — Health check endpoint (can be in main.py as a simple alternative).

- **`backend/tests/test_api/`** — New test directory. Should verify:
  - Each CRUD endpoint returns correct status codes
  - Pydantic validation works (422 on invalid input)
  - Foreign key constraints are enforced (409 on conflicts)
  - Cascade deletes work
  - Health check returns 200

- **`backend/dependencies.py`** (optional) — Could extract common dependencies like `get_db` if more complex logic is needed. For now, `database.py` has `get_db()` ready.

### Build Order

1. **First: Create `backend/main.py` with FastAPI app and health check**
   - Verify server can start: `uvicorn backend.main:app --reload`
   - Verify health endpoint works: `curl http://localhost:8000/health`

2. **Second: Implement routers for core entities (Project, ProjectItem, Supplier)**
   - Start with these three as they're the most commonly used
   - Follow standard CRUD pattern
   - Test each endpoint works via Swagger UI at `/docs`

3. **Third: Implement remaining entity routers**
   - StockItem, PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask
   - Same pattern as core entities
   - Verify all endpoints appear in Swagger UI

4. **Fourth: Write API tests**
   - Use TestClient from `fastapi.testclient`
   - Verify CRUD operations work end-to-end
   - Verify error handling (404, 422, 409)

### Verification Approach

**Start server:**
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Health check:**
```bash
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

**Swagger UI:**
- Navigate to http://localhost:8000/docs
- Verify all endpoints are listed
- Try creating a project via POST /api/projects/
- Verify response matches ProjectResponse schema

**Test commands:**
```bash
# Run API tests
pytest backend/tests/test_api/ -v

# Manual test with curl
curl -X POST http://localhost:8000/api/projects/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "client": "Test Client"}'

# Get project with items
curl http://localhost:8000/api/projects/1
```

**Test patterns:**
```python
def test_create_project(client):
    response = client.post("/api/projects/", json={
        "name": "Test Project",
        "client": "Test Client",
        "status": "Проектирование"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data

def test_get_project_with_items(client):
    # Create project with items, then fetch
    response = client.get(f"/api/projects/{project_id}")
    assert response.status_code == 200
    assert "items" in response.json()

def test_delete_project_cascade(client):
    # Delete project, verify items are also deleted
    response = client.delete(f"/api/projects/{project_id}")
    assert response.status_code == 200
    # Query for items should return empty
```

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| API testing | `TestClient` from `fastapi.testclient` | Built-in test client that doesn't require running server; makes tests fast and reliable |
| Request validation | Pydantic schemas from S02 | Already have Create/Update/Response schemas; FastAPI auto-validates |
| Session management | `get_db()` dependency in `database.py` | Already implements proper session lifecycle with yield/finally |
| Error responses | FastAPI exception handlers | HTTPException with status codes (404, 422, 409) built-in |
| Documentation | `/docs` Swagger UI | Auto-generated from Pydantic schemas and type hints |

## Constraints

- **PostgreSQL dependency** — API needs database connection. For development testing, can use `DATABASE_URL` environment variable or default to localhost PostgreSQL.
- **No authentication** — This slice does not add auth; endpoints are open (will be secured in later milestone)
- **Existing models/schemas** — Cannot change Pydantic schema definitions; must use what S02 produced
- **Async pattern** — Current `database.py` uses sync SQLAlchemy. Could migrate to async (asyncpg) but not required for this slice. Keep sync for simplicity, async can be added later.

## Common Pitfalls

- **Forgetting `commit()`** — SQLAlchemy sessions don't auto-commit; must call `db.commit()` after `add()` or `delete()`
- **Missing relationship loading** — Without `selectinload()`, accessing `project.items` will trigger lazy load queries. Should use `options(selectinload(Project.items))` in GET endpoints
- **Wrong HTTP status codes** — Use 404 for not found, 422 for validation errors, 409 for constraint violations, not generic 500
- **Cascade delete not tested** — Deleting a Project should delete its ProjectItems; verify this works as expected
- **Foreign key violations** — Trying to delete a Supplier with PurchaseOrders should fail (RESTRICT). Test this returns appropriate error
- **Not returning created object** — POST endpoints should return the created object with its assigned `id`
- **Parsing Numeric from JSON** — Pydantic converts JSON numbers to float; SQLAlchemy Numeric fields accept this. No manual conversion needed.

## Open Risks

- **PostgreSQL connection string** — Default in `.env` points to `localhost:5432`. If PostgreSQL isn't running, tests will fail. This is expected; S04 will Dockerize everything.
- **Relationship eager loading** — Current models use `lazy="selectin"`. Need to verify FastAPI endpoints don't trigger unexpected additional queries. Testing with SQLAlchemy echo enabled will show query patterns.

## Skills Discovered

None — FastAPI CRUD patterns are well-documented and standard. No project-specific skills needed.

## Sources

- [FastAPI Official Tutorial - User Guide](https://fastapi.tiangolo.com/tutorial/) — Primary reference for CRUD patterns, dependencies, and testing
- [FastAPI SQL Databases](https://fastapi.tiangolo.com/tutorial/sql-databases/) — Specific guide for SQLAlchemy integration with FastAPI
- [Testing FastAPI applications](https://fastapi.tiangolo.com/tutorial/testing/) — How to use TestClient for endpoint testing
- [SQLAlchemy Session Basics](https://docs.sqlalchemy.org/en/20/orm/session_basics.html) — Session lifecycle and commit patterns