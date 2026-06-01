# S01: PostgreSQL Schema + Alembic Setup — UAT

**Milestone:** M001
**Written:** 2026-05-31T23:10:58.255Z

# S01: PostgreSQL Schema + Alembic Setup — UAT

**Milestone:** M001
**Written:** 2026-06-01

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: Slice S01 creates database schema artifacts (migration files, models) that can be verified through SQL generation and test structure validation without requiring runtime PostgreSQL. The migration chain, foreign key ordering, and index coverage are all provable through code inspection and pytest structure tests.

## Preconditions

1. PostgreSQL client libraries installed (psycopg2-binary)
2. Python 3.12+ environment with pytest
3. DATABASE_URL configured in .env (format: postgresql+psycopg2://user:pass@localhost:5432/dbname)

## Smoke Test

Run `alembic history` - should show migration chain: `<base> → d6d07b9ba359 → e6b0df437c13 (head)`

## Test Cases

### 1. Migration Structure Validation

1. Run: `cd backend && python -m pytest tests/test_migration.py::TestMigrationStructure -v`
2. **Expected:** All 9 tests pass confirming:
   - Migration files exist with valid revision IDs
   - All 9 tables from SPEC.md defined (projects, suppliers, stock_items, project_items, purchase_orders, invoices, payments, unresolved_transactions, production_tasks)
   - 8 foreign key constraints present with proper naming
   - 15+ indexes for query performance
   - Downgrade drops tables in FK-respecting reverse order

### 2. SQL Generation Verification

1. Run: `cd backend && alembic upgrade head --sql | head -50`
2. **Expected:** Valid PostgreSQL DDL output showing:
   - CREATE TABLE statements for all 9 tables
   - CREATE INDEX statements for all indexes
   - ALTER TABLE statements for foreign key constraints
   - Proper data types (INTEGER, VARCHAR, NUMERIC(12,2), TIMESTAMP)

### 3. Models Import Test

1. Run: `cd backend && python -c "from models import Project, ProjectItem, Supplier, StockItem; print('Models imported successfully')"`
2. **Expected:** No import errors; all model classes load correctly

### 4. Migration Downgrade Generation

1. Run: `cd backend && alembic downgrade d6d07b9ba359:base --sql | head -20`
2. **Expected:** DROP TABLE statements in reverse order (production_tasks first, projects last) respecting foreign key dependencies

## Edge Cases

### Foreign Key Ordering

1. Inspect: `grep -A5 "ForeignKeyConstraint" backend/alembic/versions/d6d07b9ba359_initial_schema.py`
2. **Expected:** All FKs have named constraints (e.g., fk_project_items_project_id)

### Index Coverage

1. Run: `grep -E "ix_.*=" backend/alembic/versions/*.py | wc -l`
2. **Expected:** 15+ indexes across both migrations

## Failure Signals

- `alembic history` fails to load migration files
- pytest shows failed tests in TestMigrationStructure
- Import errors when loading models or migration modules
- Missing tables, indexes, or foreign keys in migration definitions
- Migration chain shows gaps or wrong order

## Not Proven By This UAT

- Actual database apply/rollback cycles (requires running PostgreSQL server)
- Foreign key constraint enforcement (INSERT/UPDATE validation)
- Unique constraint on stock_items.sku
- Data persistence through upgrade/downgrade cycles
- Index usage in query execution plans (EXPLAIN ANALYZE)

## Notes for Tester

The 7 skipped tests in test_migration.py (TestMigrationApply and TestMigrationWithTestData classes) will pass when:
1. PostgreSQL server is running on localhost:5432
2. Database `zakuppro` exists and is accessible
3. DATABASE_URL in .env points to valid PostgreSQL connection

To run full test suite with PostgreSQL: `cd backend && python -m pytest tests/test_migration.py -v`
