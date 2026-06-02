---
id: T02
parent: S05
milestone: M004
key_files:
  - backend/routers/unresolved_transactions.py
  - backend/schemas.py
  - backend/schemas/__init__.py
  - backend/tests/test_api/test_unresolved_transactions.py
key_decisions:
  - Reused existing Invoice/InvoiceItem relationships instead of creating new models
  - 10% tolerance chosen over 5% for suggestions (more permissive than auto-match)
  - 90-day date window for suggestions vs 30-day default matching
  - Candidates sorted by confidence to prioritize best matches for UI
  - Date proximity logged but doesn't exclude candidates (suggestions are permissive)
duration: 
verification_result: passed
completed_at: 2026-06-02T11:38:52.247Z
blocker_discovered: false
---

# T02: Added GET /api/unresolved-transactions/{id}/candidates endpoint suggesting matching invoices with 10% amount tolerance, 90-day date window, returning confidence-scored candidates for manual reconciliation

**Added GET /api/unresolved-transactions/{id}/candidates endpoint suggesting matching invoices with 10% amount tolerance, 90-day date window, returning confidence-scored candidates for manual reconciliation**

## What Happened

Created GET /api/unresolved-transactions/{transaction_id}/candidates endpoint that reuses matching logic with relaxed tolerances (10% amount, 90 days) to suggest invoice candidates for manual reconciliation.

Implementation:
- Added InvoiceCandidateResponse schema with invoice_id, supplier_name, invoice_total, amount_difference, confidence_score fields
- Added get_invoice_candidates endpoint in unresolved_transactions.py router
- Endpoint queries invoices with status "Сверен", "Ожидает оплаты", or "Оплачен"
- Calculates invoice totals from InvoiceItem.total_price aggregation
- Applies 10% amount tolerance from invoice total (inclusive bounds)
- Calculates confidence score: 1.00 for exact match, 0.75-1.00 scaled by amount proximity
- Returns candidates sorted by confidence score descending
- Includes structured logging for observability

Added 6 test cases covering empty results, exact matches, tolerance matches, exclusions, sorting, and 404 handling. All 26 unresolved_transactions tests passing.

## Verification

pytest backend/tests/test_api/test_unresolved_transactions.py::TestGetInvoiceCandidates -v (6/6 passed)
pytest backend/tests/test_api/test_unresolved_transactions.py -v (26/26 passed)

Tests verify:
- Returns empty list when no invoices exist
- Returns exact match with confidence 1.00
- Returns tolerance matches (within 10%) with confidence < 1.00
- Excludes invoices outside 10% tolerance
- Sorts candidates by confidence descending
- Returns 404 for non-existent transaction ID

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_api/test_unresolved_transactions.py::TestGetInvoiceCandidates -v` | 0 | PASS | 1710ms |
| 2 | `pytest backend/tests/test_api/test_unresolved_transactions.py -v` | 0 | PASS | 2620ms |

## Deviations

None

## Known Issues

None

## Files Created/Modified

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/schemas/__init__.py`
- `backend/tests/test_api/test_unresolved_transactions.py`
