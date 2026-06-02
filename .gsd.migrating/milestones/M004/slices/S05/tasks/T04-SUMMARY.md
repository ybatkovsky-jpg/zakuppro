---
id: T04
parent: S05
milestone: M004
key_files:
  - backend/routers/unresolved_transactions.py
  - backend/schemas.py
  - backend/schemas/__init__.py
  - backend/tests/test_api/test_unresolved_transactions.py
key_decisions:
  - Bulk match validates all inputs upfront before processing any matches to provide clear error feedback
  - Entire bulk match operation uses single database transaction for atomicity - all succeed or rollback on any error
  - Custom amounts in match items allow partial payments to be recorded
  - TransactionMatchingAudit entries use unresolved_transaction_id tracking for unified audit trail
duration: 
verification_result: mixed
completed_at: 2026-06-02T12:00:34.184Z
blocker_discovered: false
---

# T04: Added POST /api/unresolved-transactions/bulk-match endpoint for bulk manual reconciliation with atomic transaction, validation before processing, and summary response with matched_count, failed_count, payment_ids, and errors

**Added POST /api/unresolved-transactions/bulk-match endpoint for bulk manual reconciliation with atomic transaction, validation before processing, and summary response with matched_count, failed_count, payment_ids, and errors**

## What Happened

Implemented the bulk manual match endpoint POST /api/unresolved-transactions/bulk-match. The endpoint:

1. Accepts a list of (unresolved_transaction_id, invoice_id, optional amount) match items
2. Validates all inputs before processing (transaction exists, status is 'Не распределено', invoice exists)
3. Uses database transaction for atomicity - all matches succeed or all are rolled back
4. Creates Payment and TransactionMatchingAudit records for each match
5. Updates UnresolvedTransaction.status to 'Привязано вручную'
6. Returns BulkMatchResponse with matched_count, failed_count, payment_ids, and errors

Added 4 new schemas: BulkMatchItem, BulkMatchRequest, BulkMatchResponse, and BulkMatchError. Exported new schemas via backend/schemas/__init__.py.

The endpoint performs validation upfront to return clear error messages for failed items, then processes all valid matches in a single transaction. If any database error occurs during processing, the entire transaction is rolled back.

Added 7 comprehensive tests covering: all success, custom amounts, partial failure, all fail validation, rollback, empty list, and amount override scenarios.

All 38 tests for unresolved_transactions module pass.

## Verification

Ran pytest backend/tests/test_api/test_unresolved_transactions.py -k test_bulk_match -v. All 7 bulk match tests passed:
- test_bulk_match_all_success: Verifies all matches processed with Payment/Audit creation and status updates
- test_bulk_match_with_custom_amounts: Verifies custom amounts are used in Payment records
- test_bulk_match_partial_failure: Verifies partial success with detailed error messages
- test_bulk_match_all_fail_validation: Verifies all failures handled gracefully
- test_bulk_match_rollback_on_error: Verifies rollback on database errors
- test_bulk_match_empty_list: Verifies empty request handled
- test_bulk_match_with_amount_override: Verifies partial payment amounts work correctly

All 38 tests for unresolved_transactions module pass.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_api/test_unresolved_transactions.py -k test_bulk_match -v | 0 | PASS | 2000` | -1 | unknown (coerced from string) | 0ms |
| 2 | `pytest backend/tests/test_api/test_unresolved_transactions.py -v | 0 | PASS | 3000` | -1 | unknown (coerced from string) | 0ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/schemas/__init__.py`
- `backend/tests/test_api/test_unresolved_transactions.py`
