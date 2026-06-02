# S05: Transaction Matching API

**Goal:** API endpoints support unresolved transaction CRUD with filters/search, bulk manual matching, single manual match, invoice candidate suggestions, and audit history retrieval for manual reconciliation workflow
**Demo:** API endpoints support unresolved transaction CRUD, bulk manual matching, and audit history. Integration test verifies full workflow from unmatched to matched state.

## Must-Haves

- List endpoint supports filtering by status, amount range, date range, description search, and ordering
- Bulk match endpoint creates multiple Payment records with TransactionMatchingAudit entries
- Single match endpoint allows quick manual matching with audit trail
- Candidate suggestions endpoint returns invoices with confidence scores using relaxed tolerances
- Audit history endpoint shows manual and auto matches with filters
- Integration test verifies unresolved→matched workflow with all components

## Proof Level

- This slice proves: integration

## Integration Closure

- Consumes: UnresolvedTransaction model (S01), Invoice/Payment models (M003/S04), TransactionMatchingAudit (S04), PaymentMatcher service (S04)
- Produces: API endpoints for manual reconciliation, Payment records via manual match, unified audit trail
- What remains before milestone: S06 Analytics+Export+ManualUpload for dashboard and fallback upload

## Verification

- Structured logs at each endpoint operation (filter queries, match operations, candidate calculations)
- TransactionMatchingAudit extended with unresolved_transaction_id for unified audit trail
- Bulk match response includes counts and errors for transparency

## Tasks

- [ ] **T01: Add Filter and Search to UnresolvedTransaction List Endpoint** `est:1h`
  Extend GET /api/unresolved-transactions with query parameters for filtering (status, amount_min/max, date_from/to, description search) and ordering (order_by, order_dir). Build SQLAlchemy query dynamically based on provided filters. Return paginated results.
  - Files: `backend/routers/unresolved_transactions.py`, `backend/schemas.py`
  - Verify: pytest backend/tests/test_api/test_unresolved_transactions.py -k test_list -v

- [ ] **T02: Add Invoice Candidate Suggestion Endpoint** `est:1h`
  Create GET /api/unresolved-transactions/{transaction_id}/candidates endpoint. Reuse PaymentMatcher logic with relaxed tolerances (10% amount, 90 days) to suggest matching invoices. Return candidates with invoice_id, supplier_name, invoice_total, amount_difference, confidence_score.
  - Files: `backend/routers/unresolved_transactions.py`, `backend/schemas.py`
  - Verify: pytest backend/tests/test_api/test_unresolved_transactions.py -k test_candidates -v

- [ ] **T03: Add Single Manual Match Endpoint** `est:1.5h`
  Create POST /api/unresolved-transactions/{transaction_id}/match endpoint. Validate unresolved transaction exists with status 'Не распределено', validate invoice exists, create Payment record, create TransactionMatchingAudit with matched_by='manual', update UnresolvedTransaction.status to 'Привязано вручную'. Use database transaction with rollback on failure.
  - Files: `backend/routers/unresolved_transactions.py`, `backend/schemas.py`, `backend/models.py`
  - Verify: pytest backend/tests/test_api/test_unresolved_transactions.py -k test_single_match -v

- [ ] **T04: Add Bulk Manual Match Endpoint** `est:2h`
  Create POST /api/unresolved-transactions/bulk-match endpoint accepting list of (unresolved_transaction_id, invoice_id, optional amount). Validate all inputs, wrap in database transaction, create Payment and TransactionMatchingAudit records for each match, update UnresolvedTransaction statuses. Return summary with matched_count, failed_count, payment_ids, errors. Rollback entire transaction on any failure.
  - Files: `backend/routers/unresolved_transactions.py`, `backend/schemas.py`
  - Verify: pytest backend/tests/test_api/test_unresolved_transactions.py -k test_bulk_match -v

- [ ] **T05: Add Audit History Endpoint and Extend TransactionMatchingAudit** `est:1.5h`
  Add unresolved_transaction_id nullable FK to TransactionMatchingAudit model (migration not needed - DB is ephemeral in tests). Create GET /api/unresolved-transactions/audit-history endpoint with filters (transaction_id, invoice_id, date_from/to, matched_by). Return audit records with nested Invoice/BankTransaction/UnresolvedTransaction details.
  - Files: `backend/models.py`, `backend/routers/unresolved_transactions.py`, `backend/schemas.py`
  - Verify: pytest backend/tests/test_api/test_unresolved_transactions.py -k test_audit_history -v

- [ ] **T06: Write API Unit Tests** `est:2h`
  Create backend/tests/test_api/test_unresolved_transactions.py with test classes for each endpoint group. Test filters (status, amount range, date range, description search, ordering). Test candidate suggestions with different tolerances. Test single match (success, 404 on invalid, status update). Test bulk match (all success, partial failure rollback). Test audit history (filters, nested data). Use test_client fixture from conftest.py.bak pattern.
  - Files: `backend/tests/test_api/test_unresolved_transactions.py`, `backend/tests/conftest.py`
  - Verify: pytest backend/tests/test_api/test_unresolved_transactions.py -v

- [ ] **T07: Write Integration Test for Manual Matching Workflow** `est:2h`
  Create backend/tests/test_unresolved_matching_integration.py testing end-to-end workflow: create UnresolvedTransaction → get candidates → single manual match → verify Payment created → verify TransactionMatchingAudit with matched_by='manual' → verify UnresolvedTransaction.status updated → bulk match multiple transactions → audit history retrieval. Use db_session fixture with real models.
  - Files: `backend/tests/test_unresolved_matching_integration.py`
  - Verify: pytest backend/tests/test_unresolved_matching_integration.py -v

- [ ] **T08: Restore test_client Fixture and Run Full Test Suite** `est:30m`
  Copy test_client fixture from conftest.py.bak to active conftest.py. Ensure all API tests can run with TestClient. Run full test suite for unresolved_transactions to verify all endpoints work together. Fix any missing imports or dependency issues.
  - Files: `backend/tests/conftest.py`
  - Verify: pytest backend/tests/test_api/test_unresolved_transactions.py backend/tests/test_unresolved_matching_integration.py -v

## Files Likely Touched

- backend/routers/unresolved_transactions.py
- backend/schemas.py
- backend/models.py
- backend/tests/test_api/test_unresolved_transactions.py
- backend/tests/conftest.py
- backend/tests/test_unresolved_matching_integration.py
