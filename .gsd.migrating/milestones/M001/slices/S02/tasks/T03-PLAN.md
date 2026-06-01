---
estimated_steps: 42
estimated_files: 2
skills_used: []
---

# T03: Write tests for models and schemas

## Why This Task Exists

Tests verify that relationships work bidirectionally and Pydantic schemas can serialize ORM objects. Without tests, we won't know if relationships are configured correctly until S03 when FastAPI tries to use them.

## What To Do

1. Create `backend/tests/test_models.py` with tests for:

   - **Relationship traversal test**: Create a Project with ProjectItems, verify `project.items[0] == item` and `item.project == project`
   - **Cascade delete test**: Delete a Project, verify its ProjectItems are also deleted
   - **All models have relationships test**: Check each model has expected relationship attributes

2. Create `backend/tests/test_schemas.py` with tests for:

   - **from_attributes works**: Create ORM object, convert to Response schema
   - **Validation rejects invalid data**: Empty name, wrong type, etc.
   - **Nested serialization**: ProjectResponse with items
   - **Optional fields are optional**: Create schema with minimal fields

3. Use pytest fixtures for test data
4. Tests should work with SQLite (in-memory) for basic verification

## Test Structure

```python
# test_models.py
def test_project_items_relationship():
    # Create project with items
    # Verify bidirectional navigation

def test_project_cascade_delete():
    # Create project with items
    # Delete project
    # Verify items are deleted

# test_schemas.py  
def test_schema_from_attributes():
    # Create ORM object
    # Convert to schema
    # Verify fields match

def test_schema_validation_rejects_invalid():
    # Try invalid data
    # Assert ValidationError

def test_nested_schema_serialization():
    # Create project with items
    # Convert to ProjectResponse
    # Verify items are present
```

## Done When

- `test_models.py` exists with 3+ tests
- `test_schemas.py` exists with 3+ tests
- Tests pass when run with pytest
- Tests verify relationship navigation and schema validation

## Inputs

- `backend/models.py`
- `backend/schemas.py`
- `backend/tests/test_migration.py`

## Expected Output

- `backend/tests/test_models.py`
- `backend/tests/test_schemas.py`

## Verification

pytest backend/tests/test_models.py backend/tests/test_schemas.py -v

## Observability Impact

Tests provide early failure detection; pytest output shows specific assertion failures
