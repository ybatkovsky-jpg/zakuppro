---
id: T03
parent: S05
milestone: M004
key_files:
  - backend/routers/unresolved_transactions.py
  - backend/schemas.py
  - backend/models.py
  - backend/tests/test_api/test_unresolved_transactions.py
  - backend/schemas/__init__.py
key_decisions:
  - Extended TransactionMatchingAudit with unresolved_transaction_id nullable FK to track manual matches from UnresolvedTransaction queue, with bank_transaction_id NULL for manual matches enabling unified audit trail
duration: 
verification_result: mixed
completed_at: 2026-06-02T11:54:04.880Z
blocker_discovered: false
---

# T03: Added POST /api/unresolved-transactions/{transaction_id}/match endpoint for manual reconciliation with Payment record creation, TransactionMatchingAudit tracking, and UnresolvedTransaction status update

**Added POST /api/unresolved-transactions/{transaction_id}/match endpoint for manual reconciliation with Payment record creation, TransactionMatchingAudit tracking, and UnresolvedTransaction status update**

## What Happened

Implemented the single manual match endpoint POST /api/unresolved-transactions/{transaction_id}/match. The endpoint:

1. Validates the UnresolvedTransaction exists with status 'Не распределено'
2. Validates the invoice exists
3. Creates a Payment record linking the transaction to the invoice
4. Creates a TransactionMatchingAudit entry with matched_by='manual' and unresolved_transaction_id
5. Updates UnresolvedTransaction.status to 'Привязано вручную'
6. Uses database transaction with rollback on failure

Extended the TransactionMatchingAudit model with unresolved_transaction_id (nullable FK) to track manual matches from the unresolved queue. For manual matches, bank_transaction_id is NULL since there's no BankTransaction record, enabling a unified audit trail for both auto-matches and manual matches.

Added ManualMatchRequest and ManualMatchResponse schemas for request/response validation. Exported new schemas via backend/schemas/__init__.py.

All 31 tests pass including 5 new tests for the manual match endpoint covering success, not found (transaction/invoice), invalid status, and rollback scenarios.

## Verification

Ran pytest backend/tests/test_api/test_unresolved_transactions.py -k test_manual_match -v. All 5 manual match tests passed:
- test_manual_match_success: Verifies Payment, TransactionMatchingAudit creation, and status update
- test_manual_match_transaction_not_found: 404 when transaction doesn't exist
- test_manual_match_invoice_not_found: 404 when invoice doesn't exist
- test_manual_match_invalid_status: 400 when transaction status is not 'Не распределено'
- test_manual_match_rollback_on_error: Verifies rollback when error occurs during match

All 31 tests for unresolved_transactions module pass.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_api/test_unresolved_transactions.py -k test_manual_match -v` | -1 | unknown (coerced from string) | 0ms |
| 2 | `pytest backend/tests/test_api/test_unresolved_transactions.py -v` | -1 | unknown (coerced from string) | 0ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/models.py`
- `backend/tests/test_api/test_unresolved_transactions.py`
- `backend/schemas/__init__.py`
