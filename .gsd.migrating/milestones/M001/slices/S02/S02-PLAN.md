# S02: SQLAlchemy Models + Pydantic Schemas

**Goal:** Transform bare SQLAlchemy models into full ORM models with bidirectional relationships, then create Pydantic v2 schemas for request/response validation.
**Demo:** После этого: Python модели мапятся 1:1 к таблицам; Pydantic schemas валидируют вход/выход; можно создать ORM объект и сохранить в БД

## Must-Haves

- SQLAlchemy models have bidirectional relationships with back_populates
- Pydantic v2 schemas exist for all 9 entities (Create/Update/Response)
- from_attributes=True configured for ORM integration
- Tests verify relationship navigation and schema validation
- Import tests pass for both models.py and schemas.py

## Proof Level

- This slice proves: contract

## Integration Closure

Upstream surfaces consumed: PostgreSQL schema tables and foreign keys from S01 migrations; SQLAlchemy Base class from database.py.
New wiring introduced: Relationship mappings between ORM models; Pydantic schema layer for API validation.
What remains before milestone is usable: S03 will create FastAPI endpoints that use these models and schemas; S04 will Dockerize the full application.

## Verification

- Runtime signals: Import errors reveal missing relationships or circular dependencies; AttributeError indicates missing relationship attributes; ValidationError indicates schema configuration issues.
- Inspection surfaces: `python -c \"from backend.models import *\"` verifies model imports; `python -c \"from backend.schemas import *\"` verifies schema imports; pytest test output shows relationship/schema failures.
- Failure visibility: Import traceback shows exact line of circular import or missing attribute; pytest output shows which relationship or schema validation failed.
- Redaction constraints: None - no secrets in models or schemas.

## Tasks

- [x] **T01: Add SQLAlchemy relationships to models.py** `est:45m`
  ## Why This Task Exists
  - Files: `backend/models.py`
  - Verify: python -c "from backend.models import Project, ProjectItem, Supplier, StockItem, PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask; print('Models imported successfully')"

- [x] **T02: Create Pydantic v2 schemas in schemas.py** `est:1h`
  ## Why This Task Exists
  - Files: `backend/schemas.py`
  - Verify: python -c "from backend.schemas import ProjectCreate, ProjectResponse; print('Schemas imported successfully')"

- [x] **T03: Write tests for models and schemas** `est:1h`
  ## Why This Task Exists
  - Files: `backend/tests/test_models.py`, `backend/tests/test_schemas.py`
  - Verify: pytest backend/tests/test_models.py backend/tests/test_schemas.py -v

## Files Likely Touched

- backend/models.py
- backend/schemas.py
- backend/tests/test_models.py
- backend/tests/test_schemas.py
