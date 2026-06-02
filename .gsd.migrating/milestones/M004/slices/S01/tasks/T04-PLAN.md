---
estimated_steps: 13
estimated_files: 1
skills_used: []
---

# T04: Extend test_migration.py with bank statement migration tests

## Why
Verifies migration structure, FK constraints, and indexes exist before S02 uses models. Follows existing test pattern in TestMigrationStructure class.

## Do
1. Add test method to TestMigrationStructure:
   - test_bank_statement_migration_exists: verifies migration file exists
   - test_bank_statement_migration_creates_tables: checks create_table for bank_statements, bank_transactions, transaction_matching_audit
   - test_bank_statement_migration_has_fks: verifies FK constraints (fk_bank_transactions_bank_statement, fk_transaction_matching_audit_bank_transaction, fk_transaction_matching_audit_invoice)
   - test_bank_statement_migration_has_indexes: checks indexes on transaction_date, amount, supplier_inn
2. Follow existing assertion patterns from test_migration_has_foreign_keys and test_migration_has_indexes

## Done when
- New test methods added to TestMigrationStructure class
- Tests verify migration file structure, FKs, and indexes
- pytest backend/tests/test_migration.py::TestMigrationStructure passes

## Inputs

- `backend/tests/test_migration.py`
- `backend/alembic/versions/*_add_bank_statement_models.py`

## Expected Output

- `backend/tests/test_migration.py`

## Verification

pytest backend/tests/test_migration.py::TestMigrationStructure::test_bank_statement_migration_exists -v
