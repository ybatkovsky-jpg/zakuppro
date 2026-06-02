# M003-S06: Integration + End-to-End Testing — Research

**Date:** 2026-06-02
**Status:** Ready for planning

## Summary

S06 validates the complete invoice processing pipeline: **email → IMAP ingest → parse → verify → notify**. All slice dependencies (S02-S05) are complete with comprehensive unit/integration tests. The primary integration gap is the **end-to-end workflow test** that chains `parse_invoice` → `verify_invoice_task` → `dispatch_invoice_notifications` with real fixture files (dirty Excel with merged cells, multi-line headers).

## Recommendation

### What Approach to Take

1. **End-to-End Integration Test**: Create `test_s06_e2e_integration.py` that simulates the full flow:
   - Load fixture files (`test_dirty_invoice.xlsx`, `test_simple_invoice.pdf`, `test_russian_invoice.pdf`)
   - Mock IMAP input → `call_parse_invoice_task()` → parse succeeds → Invoice/InvoiceItem created
   - Call `verify_invoice_task()` → verification succeeds → Invoice.verification_result populated
   - Verify `dispatch_invoice_notifications()` was called (mock Telegram/SMTP)
   - Assert final state: Invoice.status, verification_result JSONB structure, notification dispatched

2. **Celery Task Chaining Test**: Test the intended Celery chain (documented in tasks.py:713-715):
   - `parse_invoice.apply_async(...).link(verify_invoice_task.si(invoice_id))`
   - Mock RabbitMQ/Celery to test task chaining behavior
   - Verify `invoice_id` is passed correctly from parse result to verify input

3. **Dirty Invoice Fixture Tests**: Extend test coverage for `test_dirty_invoice.xlsx`:
   - Merged cells handling (already in fixture)
   - Multi-line headers (Russian column names)
   - Empty rows/columns cleanup

4. **Error Path End-to-End Tests**: Test failure scenarios:
   - LLM parse failure → FailedTask DLQ → no notification
   - Verification error → FailedTask DLQ → error notification dispatched
   - Notification failure → task completes (non-blocking per MEM037)

5. **Integration with Real Services (Optional)**: If test IMAP/SMTP servers available:
   - Send real test email to test mailbox
   - Verify email-worker processes it
   - Verify Celery tasks complete
   - **Note**: This is production-grade testing; not required for S06 completion

### Why This Approach

- **Reuse Existing Patterns**: S03/S04 already use `call_parse_invoice_task()` and `call_verify_invoice_task()` helpers that bypass Celery wrappers. S06 extends this pattern.
- **No New Infrastructure**: Tests use existing SQLite in-memory fixtures (MEM016), mock LLM responses, and existing test files.
- **Fast, Isolated Tests**: End-to-end tests run in seconds without external services (IMAP/SMTP mocked), fitting existing test patterns.
- **Validates Integration Closure**: Confirms S02 (email-worker) → S03 (parse_invoice) → S04 (verify_invoice) → S05 (notifications) flow works end-to-end.

## Implementation Landscape

### Key Files

- **backend/tests/test_s06_e2e_integration.py** — NEW: End-to-end integration tests
- **backend/tests/test_s06_task_chaining.py** — NEW: Celery chaining tests (optional, can use existing helpers)
- **backend/tests/fixtures/test_dirty_invoice.xlsx** — EXISTS: Dirty Excel with merged cells (6259 bytes)
- **backend/tests/fixtures/test_simple_invoice.pdf** — EXISTS: Simple PDF invoice (856 bytes)
- **backend/tests/fixtures/test_russian_invoice.pdf** — EXISTS: Russian PDF invoice
- **backend/tests/test_s03_integration.py** — REFERENCE: `call_parse_invoice_task()` helper pattern
- **backend/tests/test_s04_integration.py** — REFERENCE: `call_verify_invoice_task()` helper pattern
- **backend/tasks.py** — REFERENCE: Task definitions (lines 467-693 parse_invoice, 700-841 verify_invoice, 842-1019 dispatch_invoice_notifications)

### Build Order

1. **T01: End-to-End Integration Tests** — Create `test_s06_e2e_integration.py` with full flow tests using existing helpers
2. **T02: Celery Task Chaining Tests** — Test parse → verify chaining behavior (optional if T01 covers enough)
3. **T03: Error Path End-to-End Tests** — Test failure scenarios with DLQ and non-blocking notifications
4. **T04: Dirty Invoice Fixture Validation** — Verify merged cells and Russian content parsing works correctly

## Files and Purpose

### New Files to Create

| File | Purpose |
|------|---------|
| `backend/tests/test_s06_e2e_integration.py` | End-to-end integration tests for full invoice pipeline |
| `backend/tests/test_s06_task_chaining.py` | (Optional) Celery chaining behavior tests |

### Existing Files to Reference/Extend

| File | Purpose in S06 |
|------|----------------|
| `backend/tests/test_s03_integration.py` | Reference for `call_parse_invoice_task()` helper pattern, fixture usage |
| `backend/tests/test_s04_integration.py` | Reference for `call_verify_invoice_task()` helper pattern, verification flow |
| `backend/tests/test_s05_notifications_integration.py` | Reference for notification dispatch mocking patterns |
| `backend/tasks.py` | Task definitions and chaining documentation (lines 713-715) |
| `backend/tests/fixtures/*.xlsx` `*.pdf` | Real fixture files for testing dirty invoice parsing |

## Natural Seams

Independent work units for S06:

1. **End-to-End happy path tests** — Can be written immediately using existing patterns and fixtures
2. **Celery chaining tests** — Separate from happy path; tests Celery-specific behavior (optional)
3. **Error path tests** — Independent from happy path; uses different mock/error scenarios
4. **Dirty fixture validation** — Standalone validation of existing fixtures

## First Proof

Highest-risk/unblocker is **end-to-end happy path test** because:

- Validates the entire pipeline works (S02-S05 integration)
- Exposes any incompatibilities between slice outputs
- Confirms Celery task chaining signature (invoice_id passing) works
- Uses existing helpers, so implementation is straightforward

**Verification command**: `pytest backend/tests/test_s06_e2e_integration.py -v`

## Testing Strategy

### Test Scenarios

1. **Full flow with exact SKU match**:
   - `call_parse_invoice_task()` → Invoice/InvoiceItem created
   - `call_verify_invoice_task()` → InvoiceItem.project_item_id populated
   - `dispatch_invoice_notifications()` mocked → called with correct verdict

2. **Full flow with fuzzy match**:
   - Invoice items have SKU mismatch but similar names
   - Verification returns `clarification_needed` verdict
   - Clarification email dispatched to supplier

3. **Dirty Excel parsing**:
   - Load `test_dirty_invoice.xlsx`
   - Verify merged cells handled
   - Verify empty rows cleaned
   - Verify Russian column names parsed

4. **LLM parse failure**:
   - Mock LLM to raise RateLimitError
   - Verify FailedTask created
   - Verify no notification dispatched

5. **Notification failure**:
   - Mock Telegram to raise exception
   - Verify task completes (non-blocking)
   - Verify error logged

### Mock Strategy

- **LLM**: Use existing `mock_llm_response` fixtures from S03/S04
- **Database**: Use existing `db_session` fixture (SQLite in-memory)
- **Celery**: Use `call_*_task()` helpers to bypass Celery wrapper
- **Telegram/SMTP**: Mock in `dispatch_invoice_notifications()` calls

## Constraints and Considerations

### Existing Patterns to Follow

1. **Helper Functions**: `call_parse_invoice_task()` and `call_verify_invoice_task()` bypass Celery wrappers for direct testing (MEM040)
2. **SQLite in-memory**: Fast, isolated tests without PostgreSQL dependency (MEM016)
3. **Non-blocking notifications**: Return False on failure, don't block task completion (MEM037)
4. **Fixture reuse**: Existing test fixtures cover dirty Excel, Russian PDF, simple PDF

### Gaps

1. **No real IMAP/SMTP in tests**: Tests mock external services; production validation deferred to S06 completion
2. **Celery chaining not tested**: Task chaining is documented but not tested in S03-S04; optional for S06
3. **Dirty invoice fixtures exist but not fully validated**: Fixtures have merged cells and Russian content; S06 should verify parsing handles these

### Dependencies Met

All S02-S05 slices complete with integration tests passing:
- S02: IMAP ingest with email-worker (59 tests)
- S03: Invoice parsing with LLM (62 tests)
- S04: Verification with fuzzy matching (14 tests)
- S05: Notifications with Telegram/SMTP (48 tests)

## Verification Evidence

S06 completion requires:

1. **End-to-end tests pass**: `pytest backend/tests/test_s06_e2e_integration.py -v`
2. **Dirty fixture parsing verified**: `test_dirty_invoice.xlsx` parsed successfully with merged cells handled
3. **Error paths validated**: FailedTask DLQ and non-blocking notifications work correctly
4. **Coverage >80%**: For new S06 test files

## Open Questions

None. All dependencies resolved; patterns established; fixtures available.

## Deviations

None expected. S06 builds on proven S03-S05 patterns.

## Known Limitations

1. **No real IMAP/SMTP testing**: External services mocked; production validation requires real test mailbox
2. **Celery chaining optional**: Task chaining behavior documented but not required for S06

## Follow-ups

1. **Production validation**: After S06 completion, test with real IMAP/SMTP servers if available
2. **Celery monitoring**: Add observability for task chaining failures in production
3. **Fixture expansion**: Add more dirty invoice variants as real-world scenarios emerge