# S06: Integration + End-to-End Testing

**Goal:** Create end-to-end integration tests that validate the complete invoice processing pipeline: email → IMAP ingest → parse → verify → notify. Tests use existing helpers (call_parse_invoice_task, call_verify_invoice_task) and fixtures to chain S02-S05 work together, exposing integration issues before production deployment.
**Demo:** Full flow test: send invoice email to test mailbox → IMAP ingest → parse → verify → notification. All steps execute end-to-end. Test fixtures for dirty invoices (merged cells, multi-line headers).

## Must-Haves

- End-to-end tests validate full flow with all verdict types (verified, partial, clarification_needed, failed)
- Dirty invoice fixtures (merged cells, Russian content) parse correctly
- Error paths (LLM failure, verification error, notification failure) handle gracefully
- All S06 tests pass with >80% coverage

## Proof Level

- This slice proves: integration - Tests validate real wiring between slices without external services (IMAP/SMTP mocked)

## Integration Closure

S06 validates the complete invoice pipeline from S02 (IMAP ingest) through S03 (parse), S04 (verify), to S05 (notify). Tests use existing helper patterns and mock external services, so any incompatibilities between slices surface before production.

## Verification

- End-to-end tests expose pipeline state at each stage: Invoice.status after parsing, verification_result JSONB structure, notification dispatch confirmation. FailedTask DLQ persistence verified on error paths.

## Tasks

- [x] **T01: Create end-to-end integration tests for happy path flows** `est:1h`
  ## Why
  Validates the complete invoice processing pipeline chains correctly: parse → verify → notify. Exposes incompatibilities between S02-S05 outputs.
  - Files: `backend/tests/test_s06_e2e_integration.py`
  - Verify: cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestHappyPathE2E -v

- [x] **T02: Test error path end-to-end scenarios with DLQ** `est:45m`
  ## Why
  Production failures must route to FailedTask DLQ without blocking pipeline. Error paths tested in isolation (S03-S04) need E2E validation.
  - Files: `backend/tests/test_s06_e2e_integration.py`
  - Verify: cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestErrorPathE2E -v

- [ ] **T03: Validate dirty invoice fixtures with merged cells and Russian content** `est:30m`
  ## Why
  Dirty Excel files (merged cells, multi-line headers, Russian text) are common in real invoices. Fixtures exist but aren't validated end-to-end.
  - Files: `backend/tests/test_s06_e2e_integration.py`
  - Verify: cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestDirtyFixtureValidation -v

- [ ] **T04: Run all S06 tests and verify coverage threshold** `est:15m`
  ## Why
  Slice completeness requires all new tests passing with >80% coverage. Confirms S06 validates integration closure.
  - Files: `backend/tests/test_s06_e2e_integration.py`
  - Verify: cd backend && python -m pytest tests/test_s06_e2e_integration.py -v --cov=backend.tests.test_s06_e2e_integration --cov-report=term-missing

## Files Likely Touched

- backend/tests/test_s06_e2e_integration.py
