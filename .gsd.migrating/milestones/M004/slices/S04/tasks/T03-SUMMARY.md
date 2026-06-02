---
id: T03
parent: S04
milestone: M004
key_files:
  - backend/services/payment_matcher.py
  - backend/tests/test_payment_matcher.py
key_decisions:
  - Activated Invoice.status update to 'Оплачен' on successful payment match - this was previously commented out in T02
  - Updated test fixtures to create separate invoices with unique amounts to avoid candidate ambiguity after status change prevents re-matching paid invoices
duration: 
verification_result: passed
completed_at: 2026-06-02T10:24:16.206Z
blocker_discovered: false
---

# T03: Enabled Invoice.status="Оплачен" update on successful payment match and added tests for Payment/UnresolvedTransaction creation

**Enabled Invoice.status="Оплачен" update on successful payment match and added tests for Payment/UnresolvedTransaction creation**

## What Happened

Extended PaymentMatcher to update Invoice.status to "Оплачен" (Paid) on successful payment match. The implementation was already in place for _create_payment_record and _create_unresolved_transaction methods from T02. The key change was uncommenting and activating the invoice status update in _create_payment method (line 626).

Added two new tests:
1. test_create_payment_updates_invoice_status - Verifies that Invoice.status changes from "Ожидает оплаты" to "Оплачен" after successful payment match
2. test_create_unresolved_transaction_sets_status - Verifies that UnresolvedTransaction records are created with status="Не распределено" and correct bank_date

Updated existing tests (test_tolerance_match_confidence_0_85_to_0_99, test_batch_matching, test_match_statement_transactions) to create separate invoices with unique amounts to avoid ambiguity after the Invoice.status change prevents multiple payments to the same invoice.

## Verification

Ran pytest backend/tests/test_payment_matcher.py::TestPaymentMatcher::test_create_payment_updates_invoice_status and test_create_unresolved_transaction_sets_status. Both tests PASSED, verifying:
- Payment record creation with invoice_id, amount, bank_transaction_id, payment_date
- TransactionMatchingAudit creation with confidence_score and matching_context JSON
- Invoice.status update to "Оплачен" on successful match
- UnresolvedTransaction creation with status="Не распределено", amount, description, bank_date

All 18 tests in the payment matcher test suite pass.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_payment_matcher.py::TestPaymentMatcher::test_create_payment_updates_invoice_status -v` | 0 | PASS | 260ms |
| 2 | `pytest backend/tests/test_payment_matcher.py::TestPaymentMatcher::test_create_unresolved_transaction_sets_status -v` | 0 | PASS | 260ms |
| 3 | `pytest backend/tests/test_payment_matcher.py -v` | 0 | PASS | 1150ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/services/payment_matcher.py`
- `backend/tests/test_payment_matcher.py`
