# S03: FastAPI CRUD Endpoints

**Goal:** Create FastAPI application with CRUD endpoints for all 9 entities (Project, ProjectItem, Supplier, StockItem, PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask) using existing SQLAlchemy models and Pydantic schemas from S02.
**Demo:** После этого: POST /projects создает проект; GET /projects/{id} возвращает с items; DELETE работает; Swagger UI показывает все эндпоинты

## Must-Haves

- FastAPI server starts successfully with uvicorn
- All CRUD endpoints (list, detail, create, update, delete) work for Project entity
- GET /api/projects/{id} returns project with eager-loaded items
- DELETE /api/projects/{id} cascades to project_items
- Swagger UI at /docs displays all endpoints with schemas
- Health check at /health returns 200

## Proof Level

- This slice proves: integration

## Integration Closure

Wires FastAPI app with modular routers, connects database sessions via get_db() dependency, exposes HTTP surface for all entities defined in models.py. After this slice: the API layer is complete and ready for Docker deployment in S04.

## Verification

- FastAPI /docs provides interactive API documentation; /health endpoint for readiness checks; SQLAlchemy echo=True logs SQL queries; HTTP status codes (404, 422, 409) expose error conditions.

## Tasks

- [x] **T01: Create FastAPI main app with health check** `est:30m`
  ## Why
  Create the FastAPI application entry point that will serve all CRUD endpoints. This is the foundation for the API layer.
  - Files: `backend/main.py`, `backend/routers/__init__.py`, `backend/routers/health.py`
  - Verify: uvicorn backend.main:app --reload --port 8000 &
sleep 3
curl -f http://localhost:8000/health
kill %1

- [x] **T02: Implement Project CRUD router** `est:1h`
  ## Why
  Project is the core entity with relationships (items, purchase_orders, production_tasks). Implementing it first establishes the CRUD pattern for other entities and validates the eager-loading strategy.
  - Files: `backend/routers/projects.py`, `backend/main.py`
  - Verify: python -c "from backend.main import app; from backend.routers import projects; print('Project router loaded')"
grep -q 'projects' backend/main.py

- [x] **T03: Implement remaining 8 entity routers** `est:2h`
  ## Why
  Complete the CRUD surface for all entities following the Project pattern. StockItem, Supplier, ProjectItem are high-priority; PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask complete the set.
  - Files: `backend/routers/project_items.py`, `backend/routers/suppliers.py`, `backend/routers/stock_items.py`, `backend/routers/purchase_orders.py`, `backend/routers/invoices.py`, `backend/routers/payments.py`, `backend/routers/unresolved_transactions.py`, `backend/routers/production_tasks.py`, `backend/main.py`
  - Verify: python -c "
from backend.main import app
routes = [r.path for r in app.routes]
entity_count = sum(1 for r in routes if '/api/' in r)
print(f'API routes: {entity_count}')
assert entity_count >= 45, f'Expected 45+ routes, got {entity_count}'
"
grep -c 'include_router' backend/main.py

- [x] **T04: Write API integration tests** `est:1.5h`
  ## Why
  Verify CRUD operations work end-to-end with real database. Tests catch regressions and serve as documentation for API contract.
  - Files: `backend/tests/test_api/__init__.py`, `backend/tests/test_api/test_projects.py`, `backend/tests/conftest.py`
  - Verify: pytest backend/tests/test_api/test_projects.py -v --tb=short

## Files Likely Touched

- backend/main.py
- backend/routers/__init__.py
- backend/routers/health.py
- backend/routers/projects.py
- backend/routers/project_items.py
- backend/routers/suppliers.py
- backend/routers/stock_items.py
- backend/routers/purchase_orders.py
- backend/routers/invoices.py
- backend/routers/payments.py
- backend/routers/unresolved_transactions.py
- backend/routers/production_tasks.py
- backend/tests/test_api/__init__.py
- backend/tests/test_api/test_projects.py
- backend/tests/conftest.py
