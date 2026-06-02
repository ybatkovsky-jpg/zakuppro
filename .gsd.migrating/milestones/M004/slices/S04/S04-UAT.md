# S04: Auto-Matching Service — UAT

**Milestone:** M004
**Written:** 2026-06-02T11:11:59.750Z

# S04 UAT: Auto-Matching Service

## UAT Type
Integration Test Suite - Automated verification of payment matching flow

## Preconditions
- Database with Supplier records (with INN in requisites field)
- Invoice records with status "Ожидает оплаты" linked to Suppliers via PurchaseOrder
- BankStatement with BankTransaction records from S03 parser
- Celery worker available for match_bank_transactions task

## Test Scenarios

### TC1: Exact Match - INN + Amount Match
**Steps:**
1. Create Supplier with requisites containing "ИНН: 1234567890"
2. Create Invoice with total_amount=10000 linked to Supplier
3. Create BankTransaction with supplier_inn="1234567890", amount=10000
4. Execute `match_bank_transactions(bank_statement_id=<statement_id>)`

**Expected Results:**
- Payment record created with invoice_id, amount=10000, bank_transaction_id
- TransactionMatchingAudit created with confidence_score=1.00
- Invoice.status updated to "Оплачено"
- matching_context contains: algorithm="multi-tier", amount_difference=0, confidence_score=1.00

### TC2: Tolerance Match - Amount Within ±5%
**Steps:**
1. Create Supplier with INN="9876543210"
2. Create Invoice with total_amount=10000
3. Create BankTransaction with supplier_inn="9876543210", amount=9800 (2% below)
4. Execute matching task

**Expected Results:**
- Payment record created
- TransactionMatchingAudit with confidence_score between 0.85-0.99
- matching_context.amount_difference=200
- Invoice.status updated to "Оплачено"

### TC3: No Match - Unknown Supplier
**Steps:**
1. Create BankTransaction with supplier_inn="9999999999" (not in DB)
2. Execute matching task

**Expected Results:**
- UnresolvedTransaction created with amount, description, bank_date, status="Не распределено"
- No Payment record created
- Invoice statuses unchanged

### TC4: Ambiguous Match - Multiple Candidates
**Steps:**
1. Create Supplier with INN="1111111111"
2. Create 2 Invoices with total_amount=10000 (linked to same Supplier)
3. Create BankTransaction with supplier_inn="1111111111", amount=10000
4. Execute matching task

**Expected Results:**
- UnresolvedTransaction created (ambiguous case)
- No Payment record created
- Reason logged in matching context

### TC5: Paid Invoice Protection
**Steps:**
1. Create Invoice with status="Оплачено"
2. Create BankTransaction with matching INN+amount
3. Execute matching task

**Expected Results:**
- UnresolvedTransaction created (already-paid invoice not re-matched)
- No duplicate Payment created

## Edge Cases Tested
- NULL supplier_inn in BankTransaction → UnresolvedTransaction
- Empty Supplier.requisites → NULL extracted INN → UnresolvedTransaction
- Malformed INN (wrong digit count) → UnresolvedTransaction
- Amount outside ±5% tolerance → UnresolvedTransaction
- Payment before invoice date → UnresolvedTransaction

## Not Proven By This UAT
- Real-world bank statement formats beyond Tinkoff/Ozon (covered by S02 parser tests)
- Manual bank statement upload endpoint (S06)
- Telegram alerts for parse errors (S03 coverage)
- Performance under high transaction volume (load testing not in scope)
- Manual reconciliation UI (S05)
