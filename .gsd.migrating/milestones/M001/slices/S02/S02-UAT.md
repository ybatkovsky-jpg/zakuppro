# S02: SQLAlchemy Models + Pydantic Schemas — UAT

**Milestone:** M001
**Written:** 2026-06-01T03:48:16.402Z

# S02: SQLAlchemy Models + Pydantic Schemas — UAT

**Milestone:** M001
**Written:** 2026-06-01

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice creates library code (ORM models and Pydantic schemas) that will be used by downstream FastAPI endpoints. Verification is through automated tests that prove contracts without requiring a running server.

## Preconditions

- Python 3.12+ installed with pytest
- Project dependencies installed (sqlalchemy, pydantic, pytest)

## Smoke Test

```bash
python -c "from backend.models import *; from backend.schemas import *; print('OK')"
```

Expected: `OK` printed without errors.

## Test Cases

### 1. Bidirectional Relationship Navigation

1. Create a Project in memory
2. Add ProjectItems to the project
3. Navigate from Project → ProjectItems → Project
4. **Expected:** `project.items[0].project == project` (circular reference works)

### 2. Cascade Delete

1. Create Project with ProjectItems in test database
2. Delete the Project
3. Query for orphaned ProjectItems
4. **Expected:** No orphaned ProjectItems exist (cascade worked)

### 3. Schema Validation

1. Create ORM model instance
2. Pass to Pydantic Response schema
3. **Expected:** Schema serializes without ValidationError (from_attributes=True works)

### 4. Invalid Data Rejection

1. Create ProjectCreate with invalid data (missing name, wrong type)
2. **Expected:** Pydantic ValidationError raised

## Edge Cases

### Optional Relationships

1. Create ProjectItem without Supplier or StockItem
2. **Expected:** No error - relationships are nullable

### Numeric Field Handling

1. Pass float to qty (int field)
2. **Expected:** ValidationError (qty must be int)
3. Pass int to total_cost (float field)
4. **Expected:** Accepted (Pydantic converts)

## Failure Signals

- ImportError on `from backend.models import *` - circular import or missing attribute
- ValidationError on valid ORM object - from_attributes not configured
- Test failures in relationship traversal - back_populates mismatch
- N+1 query behavior in logs - lazy loading not configured

## Not Proven By This UAT

- Database persistence (tests use SQLite in-memory)
- FastAPI endpoint integration (covered in S03)
- Concurrent access patterns
- Large dataset performance

## Notes for Tester

All tests execute in under 2 seconds using SQLite in-memory database. No PostgreSQL or external dependencies required for this slice.
