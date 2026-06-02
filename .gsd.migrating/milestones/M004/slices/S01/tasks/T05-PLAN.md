---
estimated_steps: 13
estimated_files: 1
skills_used: []
---

# T05: Extend test_models.py with BankStatement relationship and cascade tests

## Why
Verifies ORM behavior before S04 auto-matching service uses models. Confirms bidirectional relationships work and cascade delete prevents orphaned transactions.

## Do
1. Add TestBankStatementModels class to test_models.py:
   - test_bank_statement_transactions_bidirectional: BankStatement -> BankTransaction navigation works both ways
   - test_bank_statement_cascade_delete_transactions: Deleting BankStatement deletes child BankTransaction (cascade="all, delete-orphan")
   - test_bank_transaction_lazy_selectin: Verify lazy="selectin" prevents N+1 queries
2. Import BankStatement, BankTransaction, TransactionMatchingAudit in test file
3. Follow existing test patterns from TestRelationshipTraversal and TestCascadeDelete

## Done when
- TestBankStatementModels class exists with 3 test methods
- Tests verify bidirectional navigation and cascade delete
- pytest backend/tests/test_models.py::TestBankStatementModels passes

## Inputs

- `backend/tests/test_models.py`
- `backend/models.py`

## Expected Output

- `backend/tests/test_models.py`

## Verification

pytest backend/tests/test_models.py::TestBankStatementModels -v
