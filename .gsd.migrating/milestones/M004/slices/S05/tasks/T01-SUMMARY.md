---
id: T01
parent: S05
milestone: M004
key_files:
  - backend/routers/unresolved_transactions.py
  - backend/schemas.py
  - backend/tests/test_api/test_unresolved_transactions.py
  - backend/tests/conftest.py
  - backend/schemas/__init__.py
key_decisions:
  - Fixed circular import issue by loading schemas.py dynamically in schemas/__init__.py using importlib.util
duration: 
verification_result: passed
completed_at: 2026-06-02T11:30:03.021Z
blocker_discovered: false
---

# T01: Extended GET /api/unresolved-transactions with query parameter filtering (status, amount range, date range), description search, and flexible ordering. Added UnresolvedTransactionListResponse schema for paginated results.

**Extended GET /api/unresolved-transactions with query parameter filtering (status, amount range, date range), description search, and flexible ordering. Added UnresolvedTransactionListResponse schema for paginated results.**

## What Happened

Extended the unresolved transactions list endpoint to support comprehensive filtering and search capabilities. The endpoint now accepts query parameters for status filtering, amount range (min/max), date range (from/to), case-insensitive description search, and flexible ordering by multiple fields with ascending/descending direction. Also fixed the schemas package to properly re-export all schemas from schemas.py, resolving import issues that were preventing tests from running.

## Verification

Ran pytest backend/tests/test_api/test_unresolved_transactions.py with -k test_list filter. All 10 list tests passed, verifying:
- Pagination with skip/limit parameters
- Status filtering ("Не распределено", "Привязано вручную")
- Amount range filtering (amount_min, amount_max)
- Date range filtering (date_from, date_to)
- Case-insensitive description search
- Ordering by multiple fields (amount, bank_date) with both directions
- Combined filter application
- Default ordering fallback for invalid order_by values

All 20 tests for the unresolved_transactions module pass.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_api/test_unresolved_transactions.py -k test_list -v` | 0 | pass | 1740ms |
| 2 | `pytest backend/tests/test_api/test_unresolved_transactions.py -v` | 0 | pass | 1960ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/tests/test_api/test_unresolved_transactions.py`
- `backend/tests/conftest.py`
- `backend/schemas/__init__.py`
