---
id: T02
parent: S04
milestone: M004
key_files:
  - backend/services/payment_matcher.py
  - backend/tests/test_payment_matcher.py
key_decisions:
  - Tolerance calculated FROM invoice total (not transaction amount) because bank statements often have partial payments or rounding differences
  - Confidence score uses linear interpolation: 0.85 at tolerance boundary, 1.00 at exact match, proportional in between
  - Supplier INN lookup cache (Dict[int, Optional[str]]) prevents repeated text extraction from Supplier.requisites
  - Multiple candidates with confidence gap < 0.05 treated as ambiguous → UnresolvedTransaction for manual review
duration: 
verification_result: passed
completed_at: 2026-06-02T10:13:29.742Z
blocker_discovered: false
---

# T02: Created PaymentMatcher service with multi-tier matching: exact INN+amount (confidence 1.00), INN+amount±5% (confidence 0.85-0.99), Supplier INN cache, and UnresolvedTransaction handling

**Created PaymentMatcher service with multi-tier matching: exact INN+amount (confidence 1.00), INN+amount±5% (confidence 0.85-0.99), Supplier INN cache, and UnresolvedTransaction handling**

## What Happened

Created `backend/services/payment_matcher.py` with `PaymentMatcher` class following the `InvoiceVerifier` pattern. The service implements:

**Multi-tier Matching Algorithm:**
- Exact INN + exact amount match = confidence 1.00
- INN + amount within ±5% tolerance = confidence 0.85-0.99 (calculated based on proximity to exact)
- Tolerance calculated FROM invoice total, not transaction amount (handles partial payments)

**Key Features:**
- `match_transaction()` - Match single BankTransaction to invoices
- `match_batch()` - Match multiple transactions
- `match_statement_transactions()` - Match all transactions from a BankStatement
- `_get_supplier_inn()` - Supplier INN lookup cache to avoid repeated text extraction
- `_find_invoice_candidates()` - Find invoices by supplier INN via PurchaseOrder
- `_calculate_confidence()` - Proximity-based confidence scoring (0.85-1.00 range)
- `_select_best_match()` - Handle single vs multiple candidate scenarios
- `_create_payment()` - Create Payment + TransactionMatchingAudit records
- `_create_unresolved_transaction()` - Create UnresolvedTransaction for unmatched

**Edge Case Handling:**
- NULL supplier_inn → UnresolvedTransaction
- No matching invoices → UnresolvedTransaction  
- Multiple candidates with close confidence (<0.05 gap) → UnresolvedTransaction (ambiguous)
- Amount outside ±5% tolerance → No match

**Observability:**
- Logger statements for each matching stage (INN extraction, invoice lookup, tolerance checks, payment creation, unresolved creation)
- TransactionMatchingAudit.matching_context contains algorithm metadata (tolerance bounds, confidence score, invoice_id, etc.)
- Stats tracking: matched_count, unresolved_count, payment_ids in MatchResult

Created comprehensive test suite `backend/tests/test_payment_matcher.py` with 16 tests covering all scenarios. All tests pass.

**Key Decisions:**
1. Tolerance calculated FROM invoice total (not transaction amount) because bank statements often have partial payments or rounding
2. Confidence score based on proximity to exact match using linear interpolation: 0.85 + (1 - diff/tolerance_range) * 0.15
3. Uses `joinedload(Invoice.items)` to avoid N+1 queries when calculating invoice totals

## Verification


- Import verification: `python -c "from backend.services.payment_matcher import PaymentMatcher; print('OK')"` ✓
- Test suite: 16/16 tests pass covering exact match, tolerance match, edge cases, cache, batch/statement matching ✓
- Confidence calculation verified: exact match = 1.00, tolerance boundaries = 0.85-0.99 range
- Tolerance calculation verified: ±5% from invoice total correctly excludes transactions outside range
- UnresolvedTransaction creation verified for NULL INN, no invoices, multiple candidates, outside tolerance
- TransactionMatchingAudit records created with confidence_score and matching_context JSON


## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -c 'from backend.services.payment_matcher import PaymentMatcher; print("OK")'` | 0 | PASS | 800ms |
| 2 | `python -m pytest backend/tests/test_payment_matcher.py -v --tb=short` | 0 | PASS | 1100ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/services/payment_matcher.py`
- `backend/tests/test_payment_matcher.py`
