# S06: Analytics + Export + Manual Upload

**Goal:** Implement analytics endpoints (dashboard metrics, payment dynamics), Excel export for transactions, and manual bank statement upload endpoint for fallback reconciliation workflow
**Demo:** Analytics endpoints return dashboard data (paid/unpaid counts, payment dynamics). Excel export generates .xlsx file. Manual upload endpoint processes uploaded .txt statements. Integration test verifies full flow.

## Must-Haves

- Analytics endpoints return accurate dashboard metrics (paid/unpaid/pending counts, total amounts) with date range filtering
- Payment dynamics endpoint returns time-series data grouped by day/week/month
- Excel export generates downloadable .xlsx file with transaction data
- Manual upload endpoint accepts .txt bank statements, creates BankStatement/BankTransaction records, and optionally auto-matches
- 15+ unit tests and 5+ integration tests verify all functionality

## Proof Level

- This slice proves: integration

## Integration Closure

New analytics router registered in main.py. Excel export and upload endpoints use existing patterns (unresolved_transactions filters, bank_statement_parser, payment_matcher). No new wiring required beyond router registration.

## Verification

- Structured logging at all analytics/export/upload operations (filter parameters, result counts, file metadata). Integration tests verify audit trail creation for auto-matching from uploaded statements.

## Tasks

- [x] **T01: Create analytics router with dashboard metrics endpoint** `est:45m`
  ## Why
  Dashboard analytics endpoints provide frontend with key financial metrics (paid/unpaid invoice counts, total amounts, pending invoices) for project management visibility.
  - Files: `backend/routers/analytics.py`, `backend/schemas.py`, `backend/schemas/__init__.py`, `backend/main.py`, `backend/tests/test_api/test_analytics.py`
  - Verify: pytest backend/tests/test_api/test_analytics.py -v -k dashboard

- [x] **T02: Add payment dynamics time-series endpoint and Excel export for transactions** `est:1h`
  ## Why
  Payment dynamics endpoint provides time-series data for frontend charts (payments over time grouped by day/week/month). Excel export allows accountants to download transaction data for offline analysis.
  - Files: `backend/routers/analytics.py`, `backend/schemas.py`, `backend/schemas/__init__.py`, `backend/tests/test_api/test_analytics.py`
  - Verify: pytest backend/tests/test_api/test_analytics.py -v -k dynamics or export

- [x] **T03: Implement manual bank statement upload endpoint with validation and parser integration** `est:1h`
  ## Why
  Manual upload provides fallback when email Worker fails or for ad-hoc bank statement uploads outside the automated email flow.
  - Files: `backend/routers/analytics.py`, `backend/schemas.py`, `backend/schemas/__init__.py`, `backend/tests/test_api/test_analytics.py`
  - Verify: pytest backend/tests/test_api/test_analytics.py -v -k upload

- [x] **T04: Create integration test suite for analytics/export/upload end-to-end workflow** `est:45m`
  ## Why
  Integration tests verify the complete workflow from data creation through analytics queries, export download, and upload/parsing to ensure all components work together.
  - Files: `backend/tests/test_analytics_integration.py`
  - Verify: pytest backend/tests/test_analytics_integration.py -v

## Files Likely Touched

- backend/routers/analytics.py
- backend/schemas.py
- backend/schemas/__init__.py
- backend/main.py
- backend/tests/test_api/test_analytics.py
- backend/tests/test_analytics_integration.py
