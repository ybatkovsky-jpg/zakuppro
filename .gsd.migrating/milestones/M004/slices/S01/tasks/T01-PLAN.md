---
estimated_steps: 15
estimated_files: 1
skills_used: []
---

# T01: Add BankStatement, BankTransaction, TransactionMatchingAudit models to models.py

## Why
Unblocks S02 (1C ClientBank parser) and S04 (auto-matching) by providing ORM models for bank statement persistence. Following established SQLAlchemy 2.0 patterns ensures consistency with existing codebase (MEM005, MEM006).

## Do
1. Add three SQLAlchemy models at end of models.py before FailedTask:
   - BankStatement (id, bank_name, statement_date, period_start, period_end, raw_file LargeBinary, status, created_at)
   - BankTransaction (id, bank_statement_id FK, transaction_date, amount, supplier_inn, description, operation_type, created_at)
   - TransactionMatchingAudit (id, bank_transaction_id, invoice_id, matched_at, matched_by, confidence_score, matching_context JSON, created_at)
2. Use relationship(back_populates=...) for bidirectional relationships (not backref per MEM005)
3. Use lazy="selectin" on BankStatement.transactions one-to-many relationship (prevents N+1 per MEM006)
4. Use cascade="all, delete-orphan" on BankStatement.transactions relationship
5. Add indexes: ix_bank_statements_statement_date, ix_bank_transactions_transaction_date, ix_bank_transactions_supplier_inn, ix_bank_transactions_amount

## Done when
- All three models compile without errors
- Bidirectional relationships configured (back_populates on both sides)
- lazy="selectin" on BankStatement.transactions

## Inputs

- `backend/models.py`

## Expected Output

- `backend/models.py`

## Verification

python -c "from backend.models import BankStatement, BankTransaction, TransactionMatchingAudit; print('Models imported successfully')"
