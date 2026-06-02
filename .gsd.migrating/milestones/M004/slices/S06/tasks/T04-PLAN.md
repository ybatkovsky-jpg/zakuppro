---
estimated_steps: 17
estimated_files: 1
skills_used: []
---

# T04: Create integration test suite for analytics/export/upload end-to-end workflow

## Why
Integration tests verify the complete workflow from data creation through analytics queries, export download, and upload/parsing to ensure all components work together.

## Do
1. Create `backend/tests/test_analytics_integration.py` with:
   - test_dashboard_metrics_e2e: Create invoices with varying statuses, create payments, call dashboard endpoint, verify counts match
   - test_payment_dynamics_e2e: Create payments across date range, call dynamics endpoint, verify grouping works
   - test_export_download_e2e: Create payments, call export endpoint, parse .xlsx with pandas, verify row count and data integrity
   - test_upload_and_parse_e2e: Upload test 1C ClientBank .txt file, verify BankStatement/BankTransaction records created
   - test_upload_with_matching_e2e: Upload statement, verify auto-matching creates Payment or UnresolvedTransaction
2. Use direct model operations (no API calls) for faster, clearer tests
3. Include real bank statement sample data in test fixture
4. Verify audit trail creation when matching occurs

## Done when
- Integration tests cover dashboard metrics, dynamics, export, upload, and matching
- Tests verify data integrity across the workflow
- Real bank statement content is used for upload tests
- All tests pass with clean fixture teardown

## Inputs

- `backend/routers/analytics.py`
- `backend/models.py`
- `backend/services/bank_statement_parser.py`
- `backend/services/payment_matcher.py`
- `backend/tests/test_api/test_analytics.py`

## Expected Output

- `backend/tests/test_analytics_integration.py`

## Verification

pytest backend/tests/test_analytics_integration.py -v

## Observability Impact

Integration tests verify structured logging output and observability surfaces (audit trail, transaction counts) across the full workflow.
