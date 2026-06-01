---
estimated_steps: 23
estimated_files: 1
skills_used: []
---

# T06: Create integration tests for verification

## Why
Integration tests verify full pipeline with database operations, ensuring InvoiceItem.project_item_id population and Invoice.verification_result structure.

## Do
Extend `backend/tests/test_s04_integration.py` (create new file) with:

1. **Full verification flow test:**
   - Create Project with ProjectItems
   - Create PurchaseOrder
   - Create Invoice with InvoiceItems (project_item_id=None)
   - Call verify_invoice (bypass Celery wrapper like S03 pattern)
   - Verify InvoiceItem.project_item_id populated
   - Verify Invoice.verification_result structure correct
   - Verify Invoice.status updated

2. **Exact match integration test**
3. **Fuzzy match integration test**
4. **Quantity discrepancy integration test**
5. **FailedTask DLQ test**
6. **Auto-create project/PO test**

Use `call_verify_invoice_task()` helper following S03 pattern.

## Done when
- `backend/tests/test_s04_integration.py` created with 6+ integration tests
- All tests pass with `pytest backend/tests/test_s04_integration.py`
- Tests verify database state (InvoiceItem, Invoice tables)
- Tests use actual SQLAlchemy models (not test doubles)

## Inputs

- `backend/services/invoice_verifier.py`
- `backend/models.py`
- `backend/tests/test_s03_integration.py`

## Expected Output

- `backend/tests/test_s04_integration.py`

## Verification

cd backend && pytest tests/test_s04_integration.py -v

## Observability Impact

Integration tests verify end-to-end verification with database persistence
