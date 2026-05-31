# M001: Foundation — Database Schema and Core API

**Gathered:** 2025-06-01
**Status:** Ready for planning

## Project Description

ZakupPro is a furniture manufacturing MRP (Material Requirements Planning) system designed to manage the complete lifecycle from project specification through procurement, production, and installation. The system serves furniture manufacturers who need precise material calculations, supplier coordination, and production tracking.

## Why This Milestone

All five system contours (Telegram bot, web dashboard, LLM integration, Excel/1C sync, and analytics) depend on a common database and API layer. Building this foundation first prevents duplicate work, data inconsistency, and architectural dead-ends. Without M001, each contour would inevitably create its own incompatible data representations.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Start the full stack with `docker-compose up` and access FastAPI at `http://localhost:8000`
- Browse interactive API documentation at `/docs` (Swagger UI) and test all CRUD endpoints
- Run database migrations (`alembic upgrade head`) and rollbacks (`alembic downgrade -1`) without errors
- Verify all CRUD operations via automated tests that prove Create/Read/Update/Delete for each entity

### Entry point / environment

- Entry point: `docker-compose up` (local development)
- Environment: local dev with Docker Compose (PostgreSQL + FastAPI containers)
- Live dependencies involved: PostgreSQL database, FastAPI application server

## Completion Class

- Contract complete means: All SQLAlchemy models, Pydantic schemas, and CRUD endpoints are implemented with type safety and validation. Tests demonstrate each endpoint works as documented.
- Integration complete means: PostgreSQL container runs successfully, migrations apply cleanly, foreign key constraints are enforced, and the API layer can query/write real data.
- Operational complete means: `docker-compose down && docker-compose up` recreates a clean state; migrations are reversible; the system survives container restarts without data loss.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- A developer can create a Project with nested ProjectItems (BOM) via POST, retrieve it with all relationships via GET, update it, and delete it
- A PurchaseOrder cannot be created without referencing valid Supplier and ProjectItem IDs (foreign key enforcement)
- Database migrations can be upgraded from baseline to current, rolled back, and upgraded again without errors
- Swagger UI at `/docs` shows all endpoints with correct request/response schemas and can be used interactively

## Architectural Decisions

### Database Technology

**Decision:** PostgreSQL with SQLAlchemy ORM and Alembic migrations

**Rationale:** PostgreSQL provides robust foreign key enforcement, transactional integrity, and native ENUM types — essential for maintaining data consistency across complex relationships (Project → ProjectItems → PurchaseOrders → Invoices). SQLAlchemy provides type-safe Python models; Alembic enables incremental schema evolution without data loss.

**Alternatives Considered:**
- SQLite — Too limited for concurrent operations and foreign key enforcement; production-ready PostgreSQL would require migration anyway
- NoSQL (MongoDB) — Poor fit for relational MRP data with complex foreign key relationships and reporting requirements
- Direct SQL queries — Harder to maintain, type-unsafe, doesn't provide Python-level validation

---

### API Framework

**Decision:** FastAPI with Pydantic v2 schemas

**Rationale:** FastAPI provides automatic OpenAPI documentation (`/docs`), async support for future scalability, and native Pydantic validation. Pydantic v2 offers significant performance improvements and better type safety.

**Alternatives Considered:**
- Flask + Flask-RESTful — More boilerplate, no automatic type validation, manual Swagger maintenance
- Django REST Framework — Heavier dependency, opinionated structure that may conflict with our multi-contour architecture
- FastAPI < 0.100 with Pydantic v1 — Legacy, slower, deprecated patterns

---

### Migration Strategy

**Decision:** Alembic with explicit migration scripts (not pure autogenerate)

**Rationale:** Autogenerate is useful for initial drafts but produces unmaintainable migrations for complex changes (column renames, index modifications, ENUM changes). We will use autogenerate as a starting point and hand-tune each migration for clarity and reversibility.

**Alternatives Considered:**
- Pure autogenerate — Fragile, produces broken migrations for column renames and index changes
- No migrations (drop/recreate) — Unacceptable for production data preservation
- Custom migration system — Reinventing the wheel; Alembic is battle-tested

---

### Foreign Key Policy

**Decision:** Cascading deletes for hierarchical data; RESTRICT for reference integrity

**Rationale:**
- **CASCADE:** When a Project is deleted, all its ProjectItems should disappear (they have no meaning without the parent)
- **RESTRICT:** When a Supplier has existing PurchaseOrders, deletion must fail — we cannot lose procurement history
- **SET NULL:** Not used — we prefer explicit errors or cascading rather than nullable foreign keys

**Alternatives Considered:**
- All CASCADE — Too dangerous; reference history could be lost
- All RESTRICT — Creates cleanup burden; deleted Projects would leave orphaned ProjectItems

---

### Status State Machine

**Decision:** PostgreSQL ENUM with strict state definitions

**Rationale:** Furniture MRP workflows require deterministic state transitions. Projects cannot jump from "Закупки" (Procurement) to "Монтаж" (Installation) without passing through "Производство" (Production). ENUMs at the database level prevent invalid states.

**Alternatives Considered:**
- String fields — No validation; any state can be set, leading to inconsistent workflow
- Application-level validation only — Database remains unprotected; direct SQL or bugs could corrupt states

---

### BOM Hierarchy Strategy

**Decision:** Self-referential foreign key on ProjectItem (parent_item_id)

**Rationale:** Furniture specifications are naturally hierarchical (Project → Cabinet → Door → Hinge). A flat list requires complex queries to reconstruct hierarchy; a self-referential FK enables efficient recursive queries and maintains tree structure at the database level.

**Alternatives Considered:**
- Flat list with material codes — Would require application-level tree rebuilding; inefficient for deep hierarchies
- Separate hierarchy table — Overcomplicated; single self-referential FK is sufficient
- JSON hierarchy field — Non-relational, hard to query, no foreign key enforcement

---

### Stock Invariant

**Decision:** Database-level constraint: `qty_total >= qty_reserved` and `qty_available = qty_total - qty_reserved`

**Rationale:** Inventory cannot go negative. This invariant must hold at all times. Enforcing at the database level prevents application bugs from creating impossible inventory states.

**Alternatives Considered:**
- Application-only validation — Vulnerable to race conditions and bugs; could allow negative inventory
- Triggers — More complex to maintain; CHECK constraints are simpler and declarative

---

### LLM Logging Table

**Decision:** Include LlmLog table in M001 despite AI contour being built later

**Rationale:** When the AI contour begins parsing Excel and generating recommendations, it will make mistakes. Having a logging table already in place ensures we can audit, debug, and improve LLM behavior without emergency migrations.

**Alternatives Considered:**
- Add LlmLog later — Risk of schema churn when AI contour starts; emergency migrations during active development
- No LLM logging — Impossible to debug LLM decisions; no audit trail for AI actions

## Error Handling Strategy

FastAPI will return structured error responses with appropriate HTTP status codes:
- **400 Bad Request** — Pydantic validation failures (missing required fields, type mismatches)
- **404 Not Found** — Resource lookup by non-existent ID
- **409 Conflict** — Foreign key violations (attempting to delete Supplier with PurchaseOrders)
- **422 Unprocessable Entity** — Business logic violations (negative inventory, invalid state transitions)
- **500 Internal Server Error** — Unexpected failures; detailed logs for debugging

All endpoints will use exception handlers to convert database and validation errors into consistent JSON responses with human-readable messages.

## Risks and Unknowns

- **Alembic autogenerate accuracy** — Alembic may produce incorrect migrations for column renames and index changes. We will manually review every generated migration and hand-tune complex operations.
- **ENUM migration complexity** — Adding values to existing PostgreSQL ENUMs requires special handling (ALTER TYPE ... ADD VALUE). We will use raw SQL in migrations for ENUM changes.
- **Index choices** — Initial indexes are based on expected query patterns; real usage may require adjustments. We will monitor query performance and add composite indexes as needed.
- **Foreign key behavior on PostgreSQL** — Development may have used SQLite with different FK semantics. We will verify all FK constraints work correctly on PostgreSQL before declaring M001 complete.
- **Recursive BOM queries** — Hierarchical ProjectItem queries may be inefficient at depth. We will implement and test recursive CTEs for hierarchy traversal.

## Existing Codebase / Prior Art

- `.env` — Environment configuration (needs PostgreSQL connection string setup)
- `prisma/schema.prisma` — Existing Prisma schema (will be replaced by SQLAlchemy models; serves as reference for entity relationships)
- `mini-services/` — Existing microservices structure (FastAPI will follow similar patterns)
- `skills/` — Agent skill system (LlmLog table design should reference how skills invoke LLMs)

## Relevant Requirements

- **R001 (System Core)** — M001 establishes the database and API foundation that all contours depend on
- **R002 (Project Management)** — Project and ProjectItem entities enable project lifecycle tracking
- **R003 (Procurement)** — Supplier, PurchaseOrder, Invoice, and Payment entities enable procurement workflows
- **R004 (Inventory)** — StockItem entity with invariant enforcement enables inventory management
- **R005 (Production)** — ProductionTask entity enables production tracking
- **R006 (Financial)** — UnresolvedTransaction entity enables financial reconciliation

## Scope

### In Scope

- 10 core entities: Project, ProjectItem (with BOM hierarchy), Supplier, PurchaseOrder, Invoice, Payment, UnresolvedTransaction, StockItem, ProductionTask, LlmLog
- SQLAlchemy ORM models with relationships and constraints
- Alembic baseline migration and incremental migrations
- Pydantic schemas for request/response validation
- FastAPI CRUD endpoints for all entities
- Docker Compose configuration for PostgreSQL + FastAPI
- Swagger UI auto-documentation
- Unit tests for CRUD operations
- Foreign key enforcement testing
- Migration reversibility testing

### Out of Scope / Non-Goals

- Authentication/authorization (will be added in later milestone)
- Business logic beyond basic CRUD (e.g., automatic stock reservation, state transition enforcement)
- API for Telegram bot or web dashboard (specific contours built later)
- Excel/1C integration (import/export contours built later)
- LLM integration (AI contour built later; LlmLog table is prepared but unused)
- Analytics/reporting queries (analytics contour built later)
- Performance optimization (indexes added based on real usage patterns later)

## Technical Constraints

- Python 3.11+
- PostgreSQL 15+
- FastAPI with Pydantic v2
- SQLAlchemy 2.0+
- Alembic for migrations
- Docker Compose for local development
- Async PostgreSQL driver (asyncpg)

## Integration Points

- **PostgreSQL database** — Primary data store; migrations establish schema; API reads/writes via SQLAlchemy
- **Future Telegram bot** — Will consume API endpoints (not in M001)
- **Future web dashboard** — Will consume API endpoints (not in M001)
- **Future LLM contour** — Will write to LlmLog table (not in M001)
- **Future Excel/1C sync** — Will read/write via API (not in M001)

## Testing Requirements

- Unit tests for each CRUD endpoint (Create, Read, Update, Delete)
- Tests for foreign key enforcement (cannot delete Supplier with PurchaseOrders)
- Tests for unique constraints (e.g., duplicate Supplier names)
- Tests for cascading deletes (Project deletion removes ProjectItems)
- Tests for migration reversibility (upgrade → downgrade → upgrade)
- Tests for Pydantic validation (invalid data types, missing required fields)
- Integration tests that verify real database operations with test fixtures

Minimum coverage: 80% for API layer, 90% for models layer (critical business logic).

## Acceptance Criteria

- docker-compose up starts PostgreSQL and FastAPI without errors
- Swagger UI accessible at http://localhost:8000/docs with all endpoints documented
- `alembic upgrade head` applies migrations successfully
- `alembic downgrade -1` rolls back migrations successfully
- All CRUD operations work via Swagger UI for all 10 entities
- Foreign key constraints enforced (verified by tests)
- Database constraints enforced (unique, not-null, check)
- BOM hierarchy works (nested ProjectItems with parent_item_id)
- Stock invariant enforced (qty_total >= qty_reserved)
- Test suite passes with minimum coverage thresholds

## Open Questions

- None — all architectural decisions confirmed during discussion
