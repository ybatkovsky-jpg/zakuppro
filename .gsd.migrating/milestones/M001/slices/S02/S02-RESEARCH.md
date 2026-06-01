# M001-S02 — SQLAlchemy Models + Pydantic Schemas

**Date:** 2026-06-01

## Summary

Slice S02 will transform the existing SQLAlchemy models from bare column definitions into full ORM models with bidirectional relationships, then create corresponding Pydantic v2 schemas for request/response validation. The current models (in `backend/models.py`) define all 9 entities but lack relationship definitions—foreign key columns exist but have no `relationship()` mappings. This slice needs to add those relationships using SQLAlchemy 2.0's `relationship()` API with `back_populates` for bidirectional navigation, configure cascade behaviors aligned with the milestone's architectural decisions, and create Pydantic v2 schemas with `from_attributes=True` for ORM integration.

**Primary recommendation:** Use explicit `relationship(back_populates=...)` on both sides of each relationship (not `backref`), set `lazy="selectin"` for one-to-many relationships to avoid N+1 queries in the upcoming FastAPI endpoints, configure cascade deletes per the milestone's foreign key policy (CASCADE for hierarchical data like Project→ProjectItems, RESTRICT for reference data like Supplier→PurchaseOrders), and create Pydantic schemas using `model_config = ConfigDict(from_attributes=True)` with separate Create/Update/Response classes.

## Recommendation

**Approach:** Enhance existing `models.py` with relationship definitions, then create a new `schemas.py` file with Pydantic v2 models.

**Why:** 
- The existing models work for table creation but cannot navigate relationships (e.g., `project.items` is not defined). Adding relationships now enables S03 to write natural ORM queries like `db.query(Project).options(selectinload(Project.items)).all()`.
- Pydantic v2 is already in `requirements.txt` (pydantic==2.9.2) and requires explicit `from_attributes=True` for ORM mode—this is a breaking change from v1 that must be handled correctly.
- Using `back_populates` instead of `backref` makes relationships explicit on both sides, which is clearer for maintenance and matches SQLAlchemy 2.0 best practices.

## Implementation Landscape

### Key Files

- **`backend/models.py`** — Existing file with 9 model classes (Project, ProjectItem, Supplier, StockItem, PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask). All models have Column definitions but no `relationship()` decorators. File imports from `database` (Base class). This file needs relationship additions and imports for `relationship` and potentially `Mapped`, `mapped_column` if migrating to SQLAlchemy 2.0 type-annotated style (optional—current declarative style works fine).

- **`backend/schemas.py`** — New file to create. Will contain Pydantic v2 `BaseModel` classes for all 9 entities. Each entity needs:
  - `*Create` schema (input for POST endpoints)
  - `*Update` schema (input for PUT/PATCH, all fields optional)
  - `*Response` schema (output for GET endpoints, includes `id` and timestamps)
  
  Nested relationships should use `*Response` schemas recursively (e.g., `ProjectResponse.items: List[ProjectItemResponse]`).

- **`backend/database.py`** — Already has `get_db()` dependency function that will be used by FastAPI in S03. No changes needed in this slice.

- **`backend/tests/test_models.py`** — New test file. Should verify:
  - Relationships can be traversed in both directions
  - Cascade delete works as configured
  - ORM objects can be serialized to Pydantic schemas
  - Foreign key constraints prevent invalid operations

- **`backend/tests/test_schemas.py`** — New test file. Should verify:
  - Pydantic validation rejects invalid data
  - `from_attributes=True` works with ORM objects
  - Nested schemas serialize correctly
  - Optional fields are truly optional

### Build Order

1. **First: Add SQLAlchemy relationships to `models.py`**
   - This is the foundation. Pydantic schemas depend on being able to access relationship attributes.
   - Import `relationship` from `sqlalchemy.orm`
   - Add `relationship()` to each model class
   - Configure `cascade` options per the milestone's foreign key policy
   - Set `lazy="selectin"` for one-to-many relationships (optimizes for the common case of fetching a parent with its children)

2. **Second: Create `schemas.py` with Pydantic models**
   - Depends on models having relationships defined
   - Use `from_attributes=True` in `model_config`
   - Create separate Create/Update/Response classes
   - Use nested schemas for relationships (e.g., `ProjectResponse` has `items: List[ProjectItemResponse]`)

3. **Third: Write tests**
   - Tests verify both layers work together
   - Can write models tests first, then schemas tests
   - Integration test: create ORM object → convert to Pydantic → serialize to JSON

### Verification Approach

**Relationship verification:**
```python
# Create a project with items
project = Project(name="Test", client="Test Client", status="Проектирование")
item = ProjectItem(project=project, name="Door", sku="DOOR-01", qty=2)

# Verify bidirectional navigation
assert project.items[0] == item
assert item.project == project

# Verify cascade delete
db.delete(project)  # Should also delete all ProjectItems
db.commit()
assert db.query(ProjectItem).filter_by(project_id=project.id).count() == 0
```

**Schema verification:**
```python
# Verify from_attributes works
project = Project(name="Test", client="Test", status="Проектирование")
project_response = ProjectResponse.model_validate(project)
assert project_response.name == "Test"

# Verify validation rejects invalid data
with pytest.raises(ValidationError):
    ProjectCreate(name="", client="Test")  # empty name should fail

# Verify nested serialization
project_with_items = Project(...)  # with items
response = ProjectResponse.model_validate(project_with_items)
assert len(response.items) > 0
assert isinstance(response.items[0], ProjectItemResponse)
```

**Commands:**
```bash
# Run tests
pytest backend/tests/test_models.py -v
pytest backend/tests/test_schemas.py -v

# Verify imports work
python -c "from backend.models import Project, ProjectItem; print('OK')"
python -c "from backend.schemas import ProjectCreate, ProjectResponse; print('OK')"
```

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| ORM to Pydantic conversion | `model_validate()` (Pydantic v2 built-in) | Pydantic v2 has native ORM mode with `from_attributes=True` — no need for manual dict conversion or libraries like `ormar` |
| Cascade delete configuration | SQLAlchemy's `cascade="all, delete-orphan"` | Built-in cascade handling at the ORM layer, respects database FK constraints |
| Relationship lazy loading | SQLAlchemy's `lazy="selectin"` | Prevents N+1 query problem; fetches related objects in a single additional query |
| Schema validation | Pydantic v2 field validators | Built-in type coercion and validation; no need for custom validation layers |

## Constraints

- **Python 3.11+** — Project uses SQLAlchemy 2.0.35 and Pydantic 2.9.2, which require Python 3.8+ but milestone specifies 3.11+
- **Existing database schema** — Cannot change column names or types; must work with tables created by S01 migrations
- **Pydantic v2** — Must use `model_config = ConfigDict(...)` syntax, not the inner `Config` class from v1
- **No new migrations** — This slice only touches Python code (models + schemas), no database changes

## Common Pitfalls

- **Forgetting `from_attributes=True`** — Pydantic v2 requires this to read from ORM objects; without it, `model_validate(orm_object)` will fail or return empty objects
- **Using `backref` instead of `back_populates`** — `backref` creates the reverse relationship implicitly, making code harder to understand; explicit `back_populates` on both sides is clearer for maintenance
- **Wrong cascade configuration** — Using `"all, delete"` on Supplier would delete all PurchaseOrders when a Supplier is deleted, but the milestone specifies RESTRICT behavior for reference data
- **Circular imports** — Adding relationships can cause circular import errors if models reference each other and schemas also import models; keep schemas in a separate file and import models, not vice versa
- **Missing `lazy="selectin"`** — Default lazy loading causes N+1 queries in FastAPI endpoints; `selectin` fetches related objects efficiently

## Open Risks

- **No running PostgreSQL in development** — S01 tests noted that PostgreSQL may not be available. Relationship tests can still run with SQLite for basic verification, but cascade delete behavior differs between SQLite and PostgreSQL. The milestone context acknowledges this; full verification will happen when PostgreSQL is available in S03/S04.

## Skills Discovered

None — no project-specific skills for SQLAlchemy or Pydantic patterns were found in the available skills. The standard documentation and common patterns are sufficient.

## Sources

- [Basic Relationship Patterns — SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/20/orm/basic_relationships.html) — Primary reference for relationship configuration with `back_populates`
- [Models | Pydantic Docs](https://pydantic.dev/docs/validation/latest/concepts/models/) — Official documentation on `from_attributes` configuration for ORM integration
- [Unlocking the Power of Nested Pydantic Schemas in FastAPI](https://medium.com/@ajaygohil2563/unlocking-the-power-of-nested-pydantic-schemas-in-fastapi-d7c872423aa4) — Covers nested schemas for hierarchical data
- [How to do flexibly use nested pydantic models for sqlalchemy ORM](https://github.com/fastapi/fastapi/discussions/8953) — FastAPI discussion on flexible nested schemas
- [Relationships API — SQLAlchemy 2.1 Documentation](http://docs.sqlalchemy.org/en/latest/orm/relationship_api.html) — States that `back_populates` is preferred over `backref` for robust mapper configuration
- [SQLAlchemy 2.0 Loading Strategies and Performance](https://oboe.com/learn/sqlalchemy-20-loading-strategies-and-performance-b7vb2k/) — Covers `lazy="selectin"` for preventing N+1 queries
- [It's Complicated — Backref vs. Back_populates](https://medium.com/@kimberlymlove15/sqlalchemy-relationship-status-its-complicated-backref-vs-back-populates-9eaf07335a13) — Comparison of bidirectional relationship approaches