---
estimated_steps: 11
estimated_files: 1
skills_used: []
---

# T03: Validate dirty invoice fixtures with merged cells and Russian content

## Why
Dirty Excel files (merged cells, multi-line headers, Russian text) are common in real invoices. Fixtures exist but aren't validated end-to-end.

## Do
1. Extend `test_s06_e2e_integration.py` with fixture validation tests:
   - `test_dirty_excel_parsing_e2e()` — Load test_dirty_invoice.xlsx, parse with call_parse_invoice_task(), verify merged cells handled, empty rows cleaned
   - `test_russian_pdf_parsing_e2e()` — Load test_russian_invoice.pdf, parse, verify Russian column names (Артикул, Наименование, Кол-во) extracted correctly
   - `test_russian_content_in_notification()` — Parse Russian invoice, verify with fuzzy match, assert email/telegram notifications contain Russian text
2. Use existing call_parse_invoice_task() and call_verify_invoice_task() helpers
3. Assert: InvoiceItem count matches fixture rows, Russian characters preserved, notification messages not mangled

## Done when
Dirty fixture tests pass, confirming merged cells and Russian content handled correctly through the full pipeline.

## Inputs

- `backend/tests/fixtures/test_dirty_invoice.xlsx`
- `backend/tests/fixtures/test_russian_invoice.pdf`

## Expected Output

- `backend/tests/test_s06_e2e_integration.py`

## Verification

cd backend && python -m pytest tests/test_s06_e2e_integration.py::TestDirtyFixtureValidation -v

## Observability Impact

Fixture validation tests confirm dirty invoice handling works end-to-end
