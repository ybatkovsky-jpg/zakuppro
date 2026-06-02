# S04: Invoice verification with fuzzy matching — UAT

**Milestone:** M003
**Written:** 2026-06-01T22:11:47.115Z

# S04 Invoice Verification - UAT

## Verification Criteria

### Full Verification Flow
- [x] Create Project with ProjectItems (BOM)
- [x] Create PurchaseOrder linking Project to Supplier
- [x] Create Invoice with InvoiceItems (project_item_id=None)
- [x] Call verify_invoice task
- [x] Verify InvoiceItem.project_item_id populated for matched items
- [x] Verify Invoice.verification_result contains structured JSONB
- [x] Verify Invoice.status updated (Ожидает сверки → Сверен/Ошибки)

### Exact SKU Matching
- [x] Invoice item with exact SKU matches ProjectItem
- [x] InvoiceItem.project_item_id correctly linked
- [x] Match type = 'exact', name_similarity = 100.0

### Fuzzy Name Matching
- [x] Invoice item with different SKU but similar name fuzzy matches
- [x] RapidFuzz similarity >85% for fuzzy match
- [x] Match type = 'fuzzy' when threshold met

### Quantity Discrepancy Detection
- [x] Invoice qty (80) ≠ BOM qty (100) triggers discrepancy
- [x] quantity_discrepancies list populated with invoice_qty, expected_qty, discrepancy
- [x] Verdict = 'partial', Invoice.status = 'Ошибки'

### Extra Items Detection
- [x] Invoice item with no BOM match detected
- [x] extra_items list contains unmapped invoice item IDs
- [x] InvoiceItem.project_item_id remains None

### Missing Items Detection
- [x] BOM item with no invoice match detected
- [x] missing_items list contains unmapped ProjectItem IDs
- [x] Verdict = 'partial'

### FailedTask DLQ
- [x] RuntimeError during verification creates FailedTask record
- [x] FailedTask contains task_id, task_name, error_message, error_type, context

### JSONB Structure
- [x] Invoice.verification_result contains: verdict, matched_items, fuzzy_matched_items, unmapped_items, quantity_discrepancies, extra_items, missing_items, items, verified_at
- [x] All lists and nested structures validate correctly

## Test Results
All 9 integration tests pass (3.5s):
```
tests/test_s04_integration.py::TestInvoiceVerificationFlow - 8/8 passed
tests/test_s04_integration.py::TestVerificationResultStorage - 1/1 passed
```
