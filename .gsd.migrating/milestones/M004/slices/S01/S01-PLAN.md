# S01: Database Schema + BankStatement Models

**Goal:** Add BankStatement, BankTransaction, and TransactionMatchingAudit SQLAlchemy models with Alembic migration and test fixtures for Tinkoff/Ozon 1C ClientBank format samples.
**Demo:** Alembic migration creates BankStatement, BankTransaction, TransactionMatchingAudit tables with relationships. Test fixtures verify schema constraints and cascade behavior.

## Must-Haves

- BankStatement, BankTransaction, TransactionMatchingAudit models exist in models.py with explicit bidirectional relationships (back_populates) and lazy="selectin" for one-to-many
- Alembic migration creates tables with proper FK constraints, indexes on matching fields (transaction_date, amount, supplier_inn), and cascade="all, delete-orphan" for BankStatement->BankTransaction
- test_migration.py extended to verify new migration structure, FK constraints, and indexes
- test_models.py extended with BankStatement/BankTransaction relationship and cascade delete tests
- Test fixtures exist for Tinkoff and Ozon 1C ClientBank formats (tinkoff_statement.txt, ozon_bank_statement.txt)

## Proof Level

- This slice proves: integration

## Integration Closure

- Unblocks S02 (1C ClientBank parser) with ORM models for persistence
- Enables S04 auto-matching service with indexed supplier_inn, amount, transaction_date columns for query performance
- Provides audit trail foundation via TransactionMatchingAudit for manual reconciliation compliance

## Verification

- TransactionMatchingAudit.created_at provides timestamp ordering for audit trail inspection
- Indexes on transaction_date, amount, supplier_inn enable efficient auto-matching query diagnostics
- BankStatement.status allows filtering by processing state for error visibility

## Tasks

- [x] **T01: Add BankStatement, BankTransaction, TransactionMatchingAudit models to models.py** `est:45m`
  ## Why
  Unblocks S02 (1C ClientBank parser) and S04 (auto-matching) by providing ORM models for bank statement persistence. Following established SQLAlchemy 2.0 patterns ensures consistency with existing codebase (MEM005, MEM006).
  - Files: `backend/models.py`
  - Verify: python -c "from backend.models import BankStatement, BankTransaction, TransactionMatchingAudit; print('Models imported successfully')"

- [x] **T02: Create Alembic migration for bank statement tables** `est:30m`
  ## Why
  Persists new models to PostgreSQL schema with proper FK constraints and indexes for auto-matching query performance. Follows established migration naming pattern (MEM011).
  - Files: `backend/alembic/versions/*_add_bank_statement_models.py`
  - Verify: alembic current && python -c "from backend.database import engine; from sqlalchemy import inspect; print([t for t in inspect(engine).get_table_names() if 'bank' in t or 'transaction_matching' in t])"

- [x] **T03: Add Tinkoff and Ozon Bank 1C ClientBank test fixtures** `est:30m`
  ## Why
  Provides real-world sample data for S02 parser verification. Russian bank format testing ensures parser handles merged cells and Cyrillic content correctly.
  - Files: `backend/tests/fixtures/tinkoff_statement.txt`, `backend/tests/fixtures/ozon_bank_statement.txt`, `backend/tests/fixtures/README.md`
  - Verify: test -f backend/tests/fixtures/tinkoff_statement.txt && test -f backend/tests/fixtures/ozon_bank_statement.txt && grep -q 'СекцияДокумент' backend/tests/fixtures/tinkoff_statement.txt

- [x] **T04: Extend test_migration.py with bank statement migration tests** `est:30m`
  ## Why
  Verifies migration structure, FK constraints, and indexes exist before S02 uses models. Follows existing test pattern in TestMigrationStructure class.
  - Files: `backend/tests/test_migration.py`
  - Verify: pytest backend/tests/test_migration.py::TestMigrationStructure::test_bank_statement_migration_exists -v

- [x] **T05: Extend test_models.py with BankStatement relationship and cascade tests** `est:30m`
  ## Why
  Verifies ORM behavior before S04 auto-matching service uses models. Confirms bidirectional relationships work and cascade delete prevents orphaned transactions.
  - Files: `backend/tests/test_models.py`
  - Verify: pytest backend/tests/test_models.py::TestBankStatementModels -v

## Files Likely Touched

- backend/models.py
- backend/alembic/versions/*_add_bank_statement_models.py
- backend/tests/fixtures/tinkoff_statement.txt
- backend/tests/fixtures/ozon_bank_statement.txt
- backend/tests/fixtures/README.md
- backend/tests/test_migration.py
- backend/tests/test_models.py
