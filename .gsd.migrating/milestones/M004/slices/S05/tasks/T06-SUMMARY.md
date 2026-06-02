---
id: T06
parent: S05
milestone: M004
key_files:
  - backend/tests/test_api/test_unresolved_transactions.py
  - backend/tests/conftest.py.bak
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-02T12:07:26.152Z
blocker_discovered: false
---

# T06: API unit tests already existed and all 38 tests pass successfully

**API unit tests already existed and all 38 tests pass successfully**

## What Happened

The comprehensive API unit test file `backend/tests/test_api/test_unresolved_transactions.py` already existed with complete coverage of all unresolved transaction endpoints:

- **TestCreateUnresolvedTransaction** (3 tests): POST endpoint creates transactions, validates required fields
- **TestListUnresolvedTransactions** (10 tests): GET list with status filter, amount range (min/max), date range (from/to), description search, ordering (by field, direction), pagination, combined filters
- **TestGetUnresolvedTransaction** (2 tests): GET single transaction by ID with 404 handling
- **TestUpdateUnresolvedTransaction** (3 tests): PUT updates fields, partial updates, 404 handling
- **TestDeleteUnresolvedTransaction** (2 tests): DELETE removes with 204 response, 404 handling
- **TestGetInvoiceCandidates** (6 tests): GET candidates endpoint with exact match (confidence 1.00), tolerance matches (within 10%), excludes outside tolerance, sorted by confidence descending, 404 handling
- **TestManualMatch** (5 tests): POST single match creates Payment/Audit, updates status to "Привязано вручную", handles 404 for invalid transaction/invoice, validates status must be "Не распределено", rollback on error
- **TestBulkManualMatch** (7 tests): POST bulk match handles all success, custom amounts, partial failure with validation errors, all fail validation, rollback on error, empty list, amount override for partial payments

Tests use the test_client fixture pattern from conftest.py.bak and properly verify audit history (TransactionMatchingAudit with unresolved_transaction_id, bank_transaction_id null for manual matches).

## Verification

Ran pytest backend/tests/test_api/test_unresolved_transactions.py -v. All 38 tests passed in 3.04s.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_api/test_unresolved_transactions.py -v --tb=short` | 0 | pass | 3040ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tests/test_api/test_unresolved_transactions.py`
- `backend/tests/conftest.py.bak`
