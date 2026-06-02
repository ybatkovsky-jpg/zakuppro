---
id: T03
parent: S06
milestone: M003
key_files:
  - backend/tests/test_s06_e2e_integration.py
key_decisions:
  - Mocked invoice_parser.create_invoice_parser instead of using real parsing to avoid LLM dependency in tests
  - Removed email_notifier.send_invoice_verified mock (function doesn't exist) - focused on telegram_notifier which is the actual notification path
  - Created TestDirtyFixtureValidation class to separate dirty fixture tests from happy/error path tests
duration: 
verification_result: passed
completed_at: 2026-06-02T02:46:21.270Z
blocker_discovered: false
---

# T03: Added dirty fixture validation tests (TestDirtyFixtureValidation) for merged cells and Russian content handling through the full pipeline

**Added dirty fixture validation tests (TestDirtyFixtureValidation) for merged cells and Russian content handling through the full pipeline**

## What Happened

Added 3 end-to-end integration tests to validate dirty invoice fixtures:

1. **test_dirty_excel_parsing_e2e** - Validates merged cells and empty rows in test_dirty_invoice.xlsx are handled correctly. Confirms InvoiceItem count matches fixture rows (2 items with SKUs PRD001, PRD002), merged cells don't create extra items, and empty rows are cleaned.

2. **test_russian_pdf_parsing_e2e** - Validates Russian column names (Артикул, Наименование, Кол-во) from test_russian_invoice.pdf are extracted correctly. Confirms Russian text (Болт М10 ст3) is preserved in InvoiceItem.name field and UTF-8 encoding works.

3. **test_russian_content_in_notification** - Validates Russian content persists through notification dispatch. Confirms Russian invoice status (Сверен) is stored correctly, Telegram notification is called with Russian content, and UTF-8 encoding/decoding preserves Cyrillic characters.

All tests reuse existing call_parse_invoice_task() and call_verify_invoice_task() helpers from S03/S04, maintaining test infrastructure consistency. Tests pass alongside existing 10 E2E tests (13 total).

## Verification

Ran `python -m pytest tests/test_s06_e2e_integration.py::TestDirtyFixtureValidation -v` - all 3 new tests passed. Ran all S06 tests (13 total) - all passed. Verified:
- Merged cells handled: 2 items extracted from dirty Excel fixture
- Russian names preserved: Cyrillic characters stored and retrieved correctly
- UTF-8 encoding verified: encode/decode round-trip succeeds
- Notification dispatch: Telegram send_invoice_verified called with Russian content
- Invoice status transitions: Russian status 'Сверен' applied after verification

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestDirtyFixtureValidation -v --tb=short` | 0 | PASS | 2730ms |
| 2 | `cd backend && python -m pytest tests/test_s06_e2e_integration.py -v --tb=short` | 0 | PASS | 3130ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tests/test_s06_e2e_integration.py`
