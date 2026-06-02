# S01: Database Schema + BankStatement Models — UAT

**Milestone:** M004
**Written:** 2026-06-02T07:34:36.758Z

# S01 UAT: Database Schema + BankStatement Models

## UAT Type
**Infrastructure Verification** - Confirming database foundation is ready for parser and auto-matching implementation.

## Preconditions
- PostgreSQL database available (not run in current environment due to WSL limitation)
- Alembic migrations can be applied
- Test fixtures accessible to test suite

## Test Cases

### TC1: BankStatement Model Structure
**Steps:**
1. Import BankStatement from models
2. Verify all expected columns exist (id, bank_name, statement_date, period_start, period_end, raw_file, status, created_at)
3. Confirm transactions relationship has cascade="all, delete-orphan" and lazy="selectin"

**Expected Outcome:**
- All 8 columns present
- Relationship configuration matches specification
- Model is importable without errors

**Status:** ✅ PASS (T01 verification)

---

### TC2: Migration Creates Required Tables
**Steps:**
1. Inspect migration file `m0h4akx9s41v_add_bank_statement_models.py`
2. Verify upgrade() creates bank_statements, bank_transactions, and transaction_matching_audits tables
3. Verify downgrade() drops tables in reverse dependency order

**Expected Outcome:**
- All three tables created in upgrade()
- Proper FK constraints defined (fk_bank_transactions_bank_statement, fk_transaction_matching_audit_bank_transaction, fk_transaction_matching_audit_invoice)
- Indexes created on transaction_date, amount, supplier_inn

**Status:** ✅ PASS (T02 + T04 verification)

---

### TC3: Test Fixtures for Parser
**Steps:**
1. Load `tinkoff_statement.txt` fixture
2. Verify СекцияДокумент blocks present
3. Verify contains realistic Russian business data (Cyrillic, INNs, amounts)

**Expected Outcome:**
- Fixture files exist at expected paths
- Files contain valid 1C ClientBank format structure
- README.md documents fixture features

**Status:** ✅ PASS (T03 verification)

---

### TC4: ORM Cascade Delete Behavior
**Steps:**
1. Run `test_bank_statement_cascade_delete_transactions` test
2. Verify deleting BankStatement removes associated BankTransaction records

**Expected Outcome:**
- Cascade delete prevents orphaned transactions
- Test passes without errors

**Status:** ✅ PASS (T05 verification)

---

### TC5: Bidirectional Relationships
**Steps:**
1. Run `test_bank_statement_transactions_bidirectional` test
2. Verify BankStatement -> BankTransaction and BankTransaction -> BankStatement navigation works

**Expected Outcome:**
- Both relationship directions accessible
- back_populates configuration correct

**Status:** ✅ PASS (T05 verification)

## Overall UAT Result
**✅ PASS** - All 5 test cases passing. Database schema foundation ready for S02 (1C ClientBank Parser) and S04 (Auto-Matching Service).

## Not Proven By This UAT
- Actual database migration execution (requires running PostgreSQL)
- Parser functionality (S02 scope)
- Auto-matching logic (S04 scope)
- API endpoints (S05 scope)
