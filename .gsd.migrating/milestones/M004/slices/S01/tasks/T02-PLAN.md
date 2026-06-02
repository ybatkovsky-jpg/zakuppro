---
estimated_steps: 14
estimated_files: 1
skills_used: []
---

# T02: Create Alembic migration for bank statement tables

## Why
Persists new models to PostgreSQL schema with proper FK constraints and indexes for auto-matching query performance. Follows established migration naming pattern (MEM011).

## Do
1. Run `alembic revision --autogenerate -m "add_bank_statement_models"` in backend directory
2. Edit generated migration file:
   - Set down_revision = '4773ecad7cb2' (current head)
   - Verify FK constraints: fk_bank_transactions_bank_statement, fk_transaction_matching_audit_bank_transaction, fk_transaction_matching_audit_invoice
   - Add indexes: ix_bank_statements_statement_date, ix_bank_transactions_transaction_date, ix_bank_transactions_supplier_inn, ix_bank_transactions_amount
   - Ensure downgrade() drops tables in reverse order (TransactionMatchingAudit -> BankTransaction -> BankStatement)
3. Run `alembic upgrade head` to apply migration

## Done when
- Migration file exists with proper revision chain
- alembic upgrade head succeeds
- Tables exist in PostgreSQL with all columns, FKs, and indexes

## Inputs

- `backend/models.py`
- `backend/alembic/versions/4773ecad7cb2_invoice_extensions.py`

## Expected Output

- `backend/alembic/versions/*_add_bank_statement_models.py`

## Verification

alembic current && python -c "from backend.database import engine; from sqlalchemy import inspect; print([t for t in inspect(engine).get_table_names() if 'bank' in t or 'transaction_matching' in t])"
