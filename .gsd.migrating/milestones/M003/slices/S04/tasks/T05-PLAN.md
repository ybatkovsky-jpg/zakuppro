---
estimated_steps: 30
estimated_files: 1
skills_used: []
---

# T05: Create unit tests for invoice_verifier

## Why
Unit tests verify fuzzy matching logic correctness with isolated test cases for each matching tier.

## Do
Create `backend/tests/test_invoice_verifier.py` with:

1. **Exact SKU Match Test:**
   - InvoiceItem sku="BOLT-001" matches ProjectItem sku="BOLT-001"
   - Verify: project_item_id linked, match_type="exact"

2. **Fuzzy Name Match Test:**
   - InvoiceItem name="Болт М10 ст3" vs ProjectItem name="Болт M10 Ст.3"
   - Verify: similarity >85%, fuzzy match

3. **Name Mismatch Test:**
   - InvoiceItem name="Гайка М10" vs ProjectItem name="Болт М10"
   - Verify: similarity <60%, unmapped

4. **Quantity Discrepancy Test:**
   - InvoiceItem qty=100 vs ProjectItem qty=150
   - Verify: quantity_match=false, discrepancy=-50

5. **Extra Item Test:**
   - InvoiceItem has no matching ProjectItem
   - Verify: in extra_items list

6. **Missing Item Test:**
   - ProjectItem has no matching InvoiceItem
   - Verify: in missing_items list

7. **Factory function test**
8. **Initialization test**

Use mock database and InvoiceParser pattern for test isolation.

## Done when
- `backend/tests/test_invoice_verifier.py` created with 8+ unit tests
- All tests pass with `pytest backend/tests/test_invoice_verifier.py`
- Tests cover exact match, fuzzy match, quantity discrepancy, extra/missing items
- Mock database prevents real I/O

## Inputs

- `backend/services/invoice_verifier.py`
- `backend/tests/test_invoice_parser.py`

## Expected Output

- `backend/tests/test_invoice_verifier.py`

## Verification

cd backend && pytest tests/test_invoice_verifier.py -v

## Observability Impact

Unit tests provide regression protection for matching logic
