# M004-S01: Database Schema + BankStatement Models

**Date:** 2026-06-02

## Summary

Slice S01 requires creating database models for bank statement processing with three new tables: `BankStatement`, `BankTransaction`, and `TransactionMatchingAudit`. This is a straightforward data modeling task following established SQLAlchemy 2.0 patterns already used in the codebase. The schema must support 1C ClientBank format parsing (Tinkoff/Ozon banks), auto-matching payments to invoices by supplier INN, and audit trails for manual reconciliation.

The implementation involves: (1) adding three SQLAlchemy models to `backend/models.py`, (2) creating an Alembic migration following the existing naming pattern, and (3) writing test fixtures to verify schema constraints. The existing codebase provides clear patterns for relationships (back_populates), lazy loading (selectin), and cascade behavior.

Key architectural decisions from M004-CONTEXT.md: BankStatement stores raw file as BYTEA (like Invoice.raw_file), auto-matching uses supplier INN + amount ±5% + date range, and audit trail is non-destructive (TransactionMatchingAudit stores history). The Supplier model already stores banking details in `requisites` Text column (contains INN).

## Recommendation

**Approach:** Add three new models using SQLAlchemy 2.0 declarative syntax with explicit bidirectional relationships (back_populates), create Alembic migration with proper FK constraints and indexes, and write test fixtures for Tinkoff/Ozon 1C ClientBank format samples.

**Why:** This follows established patterns from Invoice/InvoiceItem/Payment models, ensures data integrity through FK constraints, enables efficient queries via indexes on matching fields (supplier_inn, amount, transaction_date), and maintains audit trail for compliance. The schema unblocks S02 (1C parser) and S04 (auto-matching service).

## Implementation Landscape

### Key Files

- `backend/models.py` — Add BankStatement, BankTransaction, TransactionMatchingAudit classes at end of file (before FailedTask). Follow existing patterns: relationship(back_populates=...), lazy="selectin" for one-to-many, cascade="all, delete-orphan" for child entities.

- `backend/alembic/versions/[hash]_add_bank_statement_models.py` — New migration file (current head: 4773ecad7cb2). Creates three tables with FK constraints, indexes on query-heavy columns (transaction_date, amount, supplier_inn), and proper downgrade path.

- `backend/tests/test_migration.py` — Extend TestMigrationStructure class with tests for new migration file existence, FK constraints, and indexes.

- `backend/tests/test_models.py` — Add test classes for BankStatement/BankTransaction relationships and cascade delete behavior.

- `backend/tests/fixtures/tinkoff_statement.txt` — Sample 1C ClientBank file for Tinkoff (СекцияДокумент format with Russian headers).

- `backend/tests/fixtures/ozon_bank_statement.txt` — Sample 1C ClientBank file for Ozon Bank.

### Build Order

1. **First:** Add SQLAlchemy models to `backend/models.py` — unblocks migration generation and ORM usage.

2. **Second:** Create Alembic migration with `alembic revision --autogenerate` then manually verify/edit — ensures schema matches models.

3. **Third:** Write test fixtures for Tinkoff/Ozon formats — provides data for S02 parser verification.

4. **Fourth:** Extend test_models.py with relationship and cascade tests — verifies ORM behavior before S04 uses models.

### Verification Approach

- **Migration tests:** Run `pytest backend/tests/test_migration.py::TestMigrationStructure` — verifies migration file exists and defines expected tables/FKs/indexes.
- **Schema validation:** Run `alembic upgrade head` then inspect schema with `\d bank_statements` in psql — confirms columns, types, and constraints.
- **ORM tests:** Run `pytest backend/tests/test_models.py::TestBankStatementModels` — verifies relationships (statement->transactions, transaction->statement), lazy loading, and cascade delete.
- **Constraint verification:** Insert invalid FK values in test DB and expect IntegrityError — confirms FK constraints enforce referential integrity.
- **Index verification:** Run `\d bank_statements` and `\d bank_transactions` in psql — confirms indexes on transaction_date, amount, supplier_inn for auto-matching query performance.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Model relationships | SQLAlchemy 2.0 relationship(back_populates=...) | Already established pattern in codebase (MEM005, MEM001), explicit bidirectional relationships |
| N+1 query prevention | lazy="selectin" for one-to-many | Proven pattern in Invoice.payments, Project.items (MEM006, MEM003) |
| Binary file storage | LargeBinary column (BYTEA in PostgreSQL) | Matches Invoice.raw_file pattern (D019 decision), files up to 1GB |
| Migration naming | Alembic [hash]_[snake_case_description].py | Established pattern (d6d07b9ba359_initial_schema.py, MEM011) |
| Cascade delete | cascade="all, delete-orphan" | Matches Project.items behavior, test pattern exists |

## Constraints

- **Current Alembic head:** 4773ecad7cb2 (invoice_extensions migration). New migration must set `down_revision: Union[str, None] = '4773ecad7cb2'`.
- **SQLAlchemy version:** 2.0 with typing annotations (revision: str = '...', down_revision: Union[str, None] = '...').
- **PostgreSQL:** Target database uses BYTEA for LargeBinary, JSONB for JSON columns (verification_result in Invoice).
- **Supplier.requisites format:** Text column containing banking details including INN (parse required for auto-matching).
- **UnresolvedTransaction exists:** Initial schema already created this table with basic columns (id, amount, description, bank_date, status). Do not recreate.

## Common Pitfalls

- **Forgot back_populates on both sides** — MEM005 gotcha: SQLAlchemy 2.0 requires explicit bidirectional relationship definition, not backref. Both BankStatement.transactions and Transaction.bank_statement must use back_populates.

- **Missing lazy="selectin" on one-to-many** — MEM006 pattern: Prevents N+1 queries when loading BankStatement with transactions. Use lazy="selectin" on BankStatement.relationship("BankTransaction", ...).

- **Alembic env.py doesn't import models** — MEM017 gotcha: Ensure `backend/alembic/env.py` imports new models before autogenerate. Add explicit import if needed (already imports `models` module).

- **Downgrade drops tables in wrong order** — Initial migration pattern: drop tables in reverse creation order respecting FK dependencies (TransactionMatchingAudit -> BankTransaction -> BankStatement).

- **Index naming conflicts** — Use descriptive index names: `ix_bank_statements_transaction_date`, `ix_bank_transactions_supplier_inn`. Avoid generic names.

## Open Risks

- **1C ClientBank format variations between banks** — Tinkoff and Ozon may use different field names or structures. Mitigation: create sample fixtures from actual bank statements during S02, adjust schema if parser reveals new requirements.

- **Supplier INN parsing complexity** — Supplier.requisites is Text column with mixed banking details. INN extraction may require regex parsing. Mitigation: add dedicated supplier.inn column in future migration if parsing proves unreliable (currently out of scope for S01).

- **TransactionMatchingAudit table growth** — Audit history could accumulate large volume. Mitigation: design schema with timestamp index for future partitioning (currently out of scope).

## Skills Discovered

No new professional agent skills discovered for core technologies (SQLAlchemy, Alembic). Existing patterns are sufficient.

## Sources

- M004-CONTEXT.md — Comprehensive milestone context with 1C ClientBank format requirements, auto-matching strategy (ИНН + amount ±5% + date range), and audit trail specification.
- backend/models.py — Existing Invoice, Payment, UnresolvedTransaction models providing patterns for relationships, lazy loading, and cascade behavior.
- backend/alembic/versions/d6d07b9ba359_initial_schema.py — Initial schema pattern for table creation, FK constraints, and index naming.
- backend/alembic/versions/4773ecad7cb2_invoice_extensions.py — Recent migration pattern for LargeBinary (raw_file) and JSON (verification_result) columns.
- backend/tests/test_migration.py — Test patterns for migration structure verification.
- backend/tests/test_models.py — Test patterns for relationship traversal and cascade delete verification.