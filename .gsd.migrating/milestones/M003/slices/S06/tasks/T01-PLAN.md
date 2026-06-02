---
estimated_steps: 16
estimated_files: 1
skills_used: []
---

# T01: Create end-to-end integration tests for happy path flows

## Why
Validates the complete invoice processing pipeline chains correctly: parse → verify → notify. Exposes incompatibilities between S02-S05 outputs.

## Do
1. Create `backend/tests/test_s06_e2e_integration.py` with:
   - `call_parse_invoice_task()` and `call_verify_invoice_task()` helpers (reused from S03/S04 patterns)
   - Mock dispatch_invoice_notifications using patch('backend.tasks.dispatch_invoice_notifications')
   - Test cases:
     - `test_full_flow_exact_sku_match()` — Parse invoice → Verify → Dispatch notification (verified verdict)
     - `test_full_flow_fuzzy_match()` — Parse invoice with SKU mismatch → Verify with clarification_needed → Email dispatched
     - `test_full_flow_quantity_discrepancy()` — Parse invoice → Verify with partial verdict → Telegram dispatched
     - `test_full_flow_verification_failed()` — Parse invalid invoice → Verify with failed verdict → Critical notification
2. Use existing fixtures: test_simple_invoice.pdf for exact match, test_dirty_invoice.xlsx for fuzzy match
3. Use SQLite in-memory db_session fixture (MEM016)
4. Assert: Invoice.status, verification_result JSONB structure, notification function called with correct verdict

## Done when
All happy path E2E tests pass, confirming parse → verify → notify chaining works with all verdict types.

## Inputs

- `backend/tests/test_s03_integration.py`
- `backend/tests/test_s04_integration.py`
- `backend/tests/test_s05_notifications_integration.py`
- `backend/tests/fixtures/test_simple_invoice.pdf`
- `backend/tests/fixtures/test_dirty_invoice.xlsx`

## Expected Output

- `backend/tests/test_s06_e2e_integration.py`

## Verification

cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestHappyPathE2E -v

## Observability Impact

E2E tests expose pipeline state transitions: Invoice.status, verification_result structure, notification confirmation
