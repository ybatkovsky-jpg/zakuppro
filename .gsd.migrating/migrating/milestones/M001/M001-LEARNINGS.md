---
phase: M001
phase_name: Foundation: Database Schema and Core API
project: zakuppro
generated: 2025-06-01T19:30:00Z
counts:
  decisions: 8
  lessons: 4
  patterns: 6
  surprises: 2
missing_artifacts: []
---

# M001 LEARNINGS.md

## Decisions

### SQLAlchemy 2.0 bidirectional relationships
**Decision:** Use `relationship(back_populates=...)` instead of `backref` for explicit bidirectional relationships on both sides of the relationship.
**Rationale:** SQLAlchemy 2.0 encourages explicit relationship definitions. Using `back_populates` makes the relationship visible on both models, improving code clarity and maintainability.
**Alternatives considered:** `backref` (implicit, less clear), one-way relationships (asymmetric navigation)
**Revisable:** no
**Source:** S02-SUMMARY.md/What Happened

### N+1 query prevention with selectin lazy loading
**Decision:** Use `lazy="selectin"` for one-to-many relationships (Project→ProjectItem, Project→PurchaseOrder, etc.) to prevent N+1 queries.
**Rationale:** Default lazy="select" causes N+1 queries when accessing related objects. selectin fetches all related objects in a single additional query.
**Alternatives considered:** lazy="joined" (single JOIN, but can duplicate parent rows), lazy="noload" (manual loading), explicit selectinload() in queries
**Revisable:** no
**Source:** S02-SUMMARY.md/What Happened

### Pydantic v2 ORM mode configuration
**Decision:** Use `model_config = ConfigDict(from_attributes=True)` for Pydantic v2 ORM mode, not the v1 inner `Config` class.
**Rationale:** Pydantic v2 changed the configuration API. The new model_config approach is the forward-compatible pattern.
**Alternatives considered:** Pydantic v1 inner Config class (deprecated), manual validators
**Revisable:** no
**Source:** S02-SUMMARY.md/What Happened

### Financial field precision with Numeric(12, 2)
**Decision:** Use SQLAlchemy `Numeric(12, 2)` for financial fields (total_cost, amount) to ensure decimal precision.
**Rationale:** Float types lose precision for monetary values. Numeric(12, 2) stores exactly 2 decimal places with up to 10 digits before the decimal.
**Alternatives considered:** Float (precision loss), Integer (stores cents, less readable), String (no type safety)
**Revisable:** no
**Source:** S01-SUMMARY.md/What Happened

### Cascade delete scope restriction
**Decision:** Apply `cascade="all, delete-orphan"` only to Project→ProjectItem (hierarchical data), not to reference relationships.
**Rationale:** ProjectItems have no meaning without a parent Project. Other relationships (Supplier→PurchaseOrder) should use RESTRICT to preserve history.
**Alternatives considered:** All CASCADE (too dangerous, data loss), all RESTRICT (leaves orphans)
**Revisable:** no
**Source:** S02-SUMMARY.md/What Happened

### FastAPI modular router architecture
**Decision:** Organize routers as separate modules per entity in backend/routers/ with standard 5-endpoint CRUD pattern.
**Rationale:** Maintains code organization as API grows. Each entity has its own router file; main.py includes all routers.
**Alternatives considered:** Single monolithic router file (harder to maintain), class-based views (more complexity)
**Revisable:** no
**Source:** S03-SUMMARY.md/What Happened

### Docker internal networking hostname
**Decision:** Use 'db' as DATABASE_URL hostname instead of localhost for Docker Compose internal networking.
**Rationale:** Services in Docker Compose communicate using service names as hostnames, not localhost.
**Alternatives considered:** localhost (incorrect for container-to-container communication), IP addresses (fragile)
**Revisable:** no
**Source:** S04-SUMMARY.md/What Happened

### Database session dependency injection
**Decision:** Use FastAPI dependency injection with generator function for database sessions, with `finally: db.close()` for cleanup.
**Rationale:** Ensures each request gets a session and connections are returned to pool after request completes.
**Alternatives considered:** Global session (not thread-safe), manual session management (error-prone)
**Revisable:** no
**Source:** S03-SUMMARY.md/What Happened

## Lessons

### SQLAlchemy 2.0 requires explicit module imports for migration autogeneration
**What happened:** Alembic env.py needed to import models (from backend.models import Base) for metadata detection during autogenerate.
**Root cause:** SQLAlchemy 2.0 uses declarative base that requires explicit imports to populate metadata.
**Fix:** Updated alembic/env.py to import models before calling target_metadata.set_base(Base)
**Source:** S01-SUMMARY.md/What Happened

### Migration verification without runtime PostgreSQL
**What happened:** Development environment lacked PostgreSQL; tests verified migration structure and SQL generation without applying to actual database.
**Root cause:** No running PostgreSQL instance available; Alembic can generate SQL without database connection using --sql flag.
**Fix:** Used alembic upgrade head --sql for DDL inspection verification; runtime tests skip until PostgreSQL available.
**Source:** S01-SUMMARY.md/Verification

### Pydantic v2 requires different field configuration for Optional
**What happened:** Pydantic v2 uses `field(default=None)` for optional fields, not `Field(default=None, ...)`
**Root cause:** Pydantic v2 changed the field assignment API; Field() is now used differently.
**Fix:** Used direct field assignments with default values for optional fields in schemas.
**Source:** S02-SUMMARY.md/What Happened

### FastAPI automatic OpenAPI documentation
**What happened:** FastAPI automatically generates Swagger UI at /docs with all endpoints, request/response schemas, without manual configuration.
**Root cause:** FastAPI framework feature; Pydantic schemas provide type information for documentation.
**Fix:** No fix needed—leveraged built-in feature for all 45 endpoints.
**Source:** S03-SUMMARY.md/What Happened

## Patterns

### Alembic migration naming convention
**Pattern:** Name migrations as `[hash]_[snake_case_description].py` (e.g., d6d07b9ba359_initial_schema.py)
**Where:** All Alembic migration files in backend/alembic/versions/
**Source:** S01-SUMMARY.md/Patterns Established

### Constraint naming convention
**Pattern:** Foreign key constraints named `fk_[table]_[column]` (e.g., fk_project_items_project_id)
**Where:** All foreign key definitions in migrations
**Source:** S01-SUMMARY.md/Patterns Established

### Index naming convention
**Pattern:** Indexes named `ix_[table]_[column]` (e.g., ix_projects_status)
**Where:** All index definitions in migrations
**Source:** S01-SUMMARY.md/Patterns Established

### Timestamp columns pattern
**Pattern:** created_at with server_default=func.now(), updated_at with onupdate=func.now()
**Where:** All database tables for auditability
**Source:** S01-SUMMARY.md/Patterns Established

### FastAPI router module structure
**Pattern:** Each router: APIRouter() instance, get_db() dependency injection, 5 CRUD endpoints, standard HTTP codes (201 create, 404 not found, 422 validation)
**Where:** All router modules in backend/routers/
**Source:** S03-SUMMARY.md/Patterns Established

### SQLite in-memory testing
**Pattern:** Use SQLite in-memory database for fast, isolated unit tests without external dependencies
**Where:** backend/tests/conftest.py fixture configuration
**Source:** S02-SUMMARY.md/Patterns Established

## Surprises

### No PostgreSQL required for migration development
**Discovery:** Alembic can generate and verify migration SQL without a running PostgreSQL instance using --sql flag.
**Impact:** Enabled development without Docker infrastructure; accelerated iteration cycle.
**Source:** S01-SUMMARY.md/What Happened

### FastAPI route count from include_router statements
**Discovery:** Each router module contributes exactly 5 routes (list, detail, create, update, delete); 9 entities + health = 46 total routes.
**Impact:** Route counting verification became simple arithmetic: (n_entities × 5) + health
**Source:** S03-SUMMARY.md/What Happened
