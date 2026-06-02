# S05: Transaction Matching API — UAT

**Milestone:** M004
**Written:** 2026-06-02T12:15:28.620Z

# UAT: Transaction Matching API

## Test Preconditions
- Backend service running with test database
- UnresolvedTransaction records exist with status 'Не распределено'
- Invoice records exist with status 'Сверен', 'Ожидает оплаты', or 'Оплачен'
- Test data includes amounts within and outside tolerance ranges

## UAT Type
End-to-end API verification covering manual reconciliation workflow

## Test Cases

### TC1: List Unresolved Transactions with Filters
**Steps:**
1. Call GET /api/unresolved-transactions with query parameters: status='Не распределено', amount_min=1000, amount_max=50000, date_from='2024-01-01', date_to='2024-12-31', search='поставка', order_by='amount', order_dir='desc', skip=0, limit=10
2. Verify response contains paginated results matching filter criteria
3. Verify results sorted by amount descending

**Expected Outcomes:**
- Returns UnresolvedTransactionListResponse with items array
- Items match filter conditions (status, amount range, date range, description contains search term)
- Items sorted by amount descending
- Pagination respects skip/limit

**Not Proven By This UAT:**
- UI integration with frontend
- Real-world data volumes

---

### TC2: Get Invoice Candidates for Manual Match
**Steps:**
1. Create UnresolvedTransaction with amount=10000, bank_date='2024-06-15', description='ООО Ромашка'
2. Create Invoice with total=10000 (exact match)
3. Create Invoice with total=10500 (within 10% tolerance)
4. Create Invoice with total=12000 (outside 10% tolerance)
5. Call GET /api/unresolved-transactions/{transaction_id}/candidates

**Expected Outcomes:**
- Returns candidates sorted by confidence descending
- Exact match (10000) has confidence 1.00
- Tolerance match (10500) has confidence < 1.00
- Invoice outside tolerance (12000) excluded from results
- Each candidate includes invoice_id, supplier_name, invoice_total, amount_difference, confidence_score

**Not Proven By This UAT:**
- Candidate selection by human operator
- Confidence threshold tuning for production

---

### TC3: Single Manual Match
**Steps:**
1. Create UnresolvedTransaction with status='Не распределено', amount=10000
2. Create Invoice with id=1
3. Call POST /api/unresolved-transactions/{transaction_id}/match with body {invoice_id: 1}
4. Verify GET /api/payments returns new payment linking transaction to invoice
5. Verify GET /api/unresolved-transactions/audit-history includes audit entry with matched_by='manual'
6. Verify GET /api/unresolved-transactions/{transaction_id} returns status='Привязано вручную'

**Expected Outcomes:**
- Payment record created linking transaction to invoice
- TransactionMatchingAudit entry created with matched_by='manual', unresolved_transaction_id set
- UnresolvedTransaction.status updated to 'Привязано вручную'
- Returns 200 OK with Payment details

**Not Proven By This UAT:**
- Concurrent match attempts
- Undo/reverse operations

---

### TC4: Bulk Manual Match
**Steps:**
1. Create 3 UnresolvedTransaction records with status='Не распределено'
2. Create 2 Invoice records
3. Call POST /api/unresolved-transactions/bulk-match with body: {matches: [{unresolved_transaction_id: 1, invoice_id: 1, amount: 10000}, {unresolved_transaction_id: 2, invoice_id: 1}, {unresolved_transaction_id: 3, invoice_id: 2, amount: 5000}]}
4. Verify GET /api/payments returns 3 new payments
5. Verify GET /api/unresolved-transactions/audit-history includes 3 audit entries
6. Verify all UnresolvedTransaction records have status='Привязано вручную'

**Expected Outcomes:**
- All matches processed in single atomic transaction
- BulkMatchResponse returns matched_count=3, payment_ids array
- 3 Payment records created
- 3 TransactionMatchingAudit entries with matched_by='manual'
- All UnresolvedTransaction statuses updated
- Returns 200 OK

**Not Proven By This UAT:**
- Very large bulk operations (1000+ items)
- Partial rollback scenarios

---

### TC5: Audit History Retrieval
**Steps:**
1. Perform manual match creating audit entry
2. Call GET /api/unresolved-transactions/audit-history with filters: transaction_id={id}, matched_by='manual', date_from='2024-01-01', date_to='2024-12-31', skip=0, limit=10
3. Verify response includes audit entry with nested UnresolvedTransaction and Invoice details
4. Call GET /api/unresolved-transactions/audit-history with invoice_id filter
5. Verify same audit entry returned

**Expected Outcomes:**
- Returns AuditHistoryListResponse with items array
- Audit entries include nested transaction/invoice/bank_transaction details
- Filters work correctly (by transaction_id, invoice_id, matched_by, date range)
- Pagination works correctly
- Results ordered by matched_at descending

**Not Proven By This UAT:**
- Audit log export/reporting
- Long-term audit retention

---

### TC6: End-to-End Workflow
**Steps:**
1. Create UnresolvedTransaction from bank statement parse
2. Call GET /api/unresolved-transactions to list unmatched transactions
3. Call GET /api/unresolved-transactions/{transaction_id}/candidates to get suggestions
4. Call POST /api/unresolved-transactions/{transaction_id}/match with selected invoice
5. Call GET /api/unresolved-transactions/audit-history to verify match recorded
6. Verify transaction no longer appears in unmatched list

**Expected Outcomes:**
- Transaction appears in initial unmatched list
- Candidates endpoint returns matching invoices with confidence scores
- Manual match succeeds and creates Payment + Audit entries
- Transaction status changes to 'Привязано вручную'
- Transaction excluded from subsequent unmatched queries
- Full audit trail preserved

**Not Proven By This UAT:**
- Frontend UI workflow
- Real-time WebSocket updates

---

### TC7: Error Handling
**Steps:**
1. Call POST /api/unresolved-transactions/{nonexistent_id}/match → expect 404
2. Call POST /api/unresolved-transactions/{id}/match with nonexistent invoice_id → expect 404
3. Call POST /api/unresolved-transactions/{matched_id}/match on already matched transaction → expect 400
4. Call POST /api/unresolved-transactions/bulk-match with invalid data → expect validation errors

**Expected Outcomes:**
- Not found errors return 404 with clear error messages
- Invalid status errors return 400
- Bulk match returns detailed errors for failed items
- No database corruption on error (rollback verified)

**Not Proven By This UAT:**
- Custom error page rendering
- Error localization (Russian messages)
