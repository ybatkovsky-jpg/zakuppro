# M003-S03: Invoice Parsing with LLM — Research

**Date:** 2026-06-02
**Status:** Ready for planning
**Depth:** Targeted research — extends proven patterns with PDF support

## Summary

Slice S03 implements **invoice parsing service** for PDF and Excel files using the LLM provider wrapper from S01. The invoice_parser.py service already exists with full PDF/Excel extraction logic and LLM integration. The parse_invoice Celery task in tasks.py already calls this service and saves to Invoice/InvoiceItem tables.

**Key Finding:** S03 code is 95% complete. The `invoice_parser.py` service implements full PDF (pdfplumber) and Excel (pandas) extraction with LLM structured output. The `parse_invoice` Celery task in `tasks.py` orchestrates the full pipeline: file parsing → LLM extraction → Invoice/InvoiceItem database persistence → FailedTask DLQ handling.

**Remaining work:** Add `pdfplumber` to requirements.txt, create comprehensive unit tests for invoice_parser.py service, and create end-to-end integration tests with mock LLM responses.

## Existing Code (Complete)

### invoice_parser.py Service
**File:** `backend/services/invoice_parser.py` (~325 lines)

**Features:**
- `InvoiceParser` class with LLM provider injection
- `parse_file(filename, file_content, metadata)` method
- PDF extraction via pdfplumber (text + tables → markdown)
- Excel extraction via pandas (all sheets → markdown)
- LLM structured extraction via `llm_provider.parse_invoice()`
- Error handling for transient (retryable) vs non-retryable errors
- Factory function `create_invoice_parser()`

**Key Methods:**
- `_extract_pdf_text(file_content)` — pdfplumber with table extraction
- `_extract_excel_text(file_content)` — pandas with multi-sheet support
- `_table_to_markdown(table)` — Convert PDF tables to markdown
- `_dataframe_to_markdown(df)` — Convert pandas DataFrame to markdown

### parse_invoice Celery Task
**File:** `backend/tasks.py` (lines 467-697)

**Flow:**
1. Receives (filename, file_content, metadata) from email_worker
2. Calls `InvoiceParser.parse_file()`
3. Creates Supplier from email metadata (via `find_or_create_supplier`)
4. Creates or finds Project + PurchaseOrder
5. Creates Invoice record with raw_file BLOB and raw_text
6. Creates InvoiceItem records for each extracted line item
7. Returns success with invoice_id, items_count
8. FailedTask DLQ persistence on error

**Error Handling:**
- RateLimitError → Celery retry with exponential backoff
- Other errors → FailedTask record + re-raise for DLQ

### llm_provider.py (from S01)
**File:** `backend/llm_provider.py` (~735 lines)

**Relevant for S03:**
- `LLMProvider.parse_invoice(table_markdown)` — Main extraction method
- `ExtractedInvoice` Pydantic model with items + metadata
- `InvoiceItem` Pydantic model with sku, name, qty, supplier
- `DEFAULT_SYSTEM_PROMPT` with Russian column mapping
- Automatic fallback on rate limit/timeout
- OpenAI JSON Schema strict mode for guaranteed valid output

## Database Schema (from S01)

### Invoice Table
- `raw_file: LargeBinary` — BLOB storage for original PDF/Excel
- `verification_result: JSON` — Will be populated in S04
- `status: String` — Default "Ожидает сверки"
- `purchase_order_id: FK` → Links to PO

### InvoiceItem Table
- `invoice_id: FK` → Belongs to Invoice
- `project_item_id: FK nullable` → Will be mapped in S04 verification
- `sku, name, qty, unit_price, total_price` — Extracted fields
- `cascade='all, delete-orphan'` relationship from Invoice

## Dependencies

**Already in requirements.txt:**
- pandas==2.2.3 — Excel file reading
- openpyxl==3.1.5 — Excel format support
- openai==1.54.0 — Primary LLM provider
- anthropic==0.40.0 — Secondary LLM provider
- google-generativeai==0.8.3 — Tertiary LLM provider

**Missing from requirements.txt:**
- `pdfplumber` — Required for PDF text extraction (used in invoice_parser.py)
- Add: `pdfplumber==0.11.4`

## Known Patterns to Follow

### From ai_agent.py (Excel BOM extraction)
- Retry with exponential backoff: `[1, 2, 4]` seconds delays
- Rate limit distinction: retry vs fail immediately
- Pydantic validation after LLM response
- Russian column mapping in system prompt

### From llm_provider.py
- Strategy pattern for provider abstraction
- Lazy client initialization
- Configuration-driven provider selection via env vars
- JSON Schema strict mode for structured output

### From excel_parser.py
- Header row detection for dirty tables
- Empty row/column cleanup
- Markdown table conversion for LLM input

## Implementation Landscape

### Files Already Complete
1. `backend/services/invoice_parser.py` — Full service implementation
2. `backend/tasks.py` — parse_invoice task with full orchestration
3. `backend/llm_provider.py` — Provider-agnostic wrapper (S01)
4. `backend/models.py` — Invoice/InvoiceItem models (S01)
5. `backend/excel_parser.py` — Excel utilities (existing)
6. `backend/tests/test_s03_integration.py` — Integration test scaffold

### Files to Create/Modify
1. `backend/requirements.txt` — Add pdfplumber dependency
2. `backend/tests/test_invoice_parser.py` — Unit tests for InvoiceParser
3. `backend/tests/fixtures/test_invoice.pdf` — PDF test fixture
4. `backend/tests/fixtures/test_invoice.xlsx` — Excel test fixture

## Testing Strategy

### Unit Tests for invoice_parser.py
**File:** `backend/tests/test_invoice_parser.py`

**Test Cases:**
1. `test_invoice_parser_creation` — Factory function creates parser
2. `test_parse_excel_file` — Excel file extraction with mock LLM
3. `test_parse_pdf_file` — PDF file extraction with mock LLM
4. `test_unsupported_format_raises` — .txt file raises ValueError
5. `test_llm_transient_error_propagates` — RateLimitError propagates for Celery retry
6. `test_llm_nonretryable_error_returns_error_dict` — Provider error returns error status
7. `test_pdf_extraction_with_tables` — PDF tables converted to markdown
8. `test_excel_multi_sheet_extraction` — All sheets processed
9. `test_empty_file_returns_error` — Empty PDF/Excel returns error status
10. `test_metadata_passed_to_llm` — Email metadata included in parse result

**Mocking:**
- Mock `LLMProvider.parse_invoice()` to return predefined `ExtractedInvoice`
- Mock pdfplumber for PDF tests (avoid real file I/O)
- Mock pandas for Excel tests (avoid real file I/O)

### Integration Tests
**File:** `backend/tests/test_s03_integration.py` (extend existing)

**Test Cases:**
1. `test_full_parse_invoice_task` — Mock LLM + real DB operations
2. `test_invoice_blob_storage` — Verify raw_file saved correctly
3. `test_invoice_item_creation` — Verify all items saved with Decimal prices
4. `test_supplier_auto_creation` — Verify supplier created from email
5. `test_failed_task_on_error` — Verify DLQ handling

### Fixtures Required
1. `tests/fixtures/test_simple_invoice.pdf` — Single-page PDF with table
2. `tests/fixtures/test_dirty_invoice.xlsx` — Multi-sheet Excel with merged cells
3. `tests/fixtures/test_russian_invoice.pdf` — PDF with Russian headers

## Don't Hand-Roll (Use Libraries)

### PDF Processing
**Use:** `pdfplumber` — Already implemented in invoice_parser.py
- Better table extraction than PyPDF2
- Handles multi-page PDFs
- Extracts both text and tables

**Don't use:**
- PyPDF2 — Poor table extraction
- pdfminer.six — Lower-level, more complex
- fitz (PyMuPDF) — Heavier dependency

### Excel Processing
**Use:** `pandas` with `openpyxl` engine — Already implemented
- Proven pattern from excel_parser.py
- Handles merged cells
- Multi-sheet support

**Don't use:**
- xlrd — Deprecated, no .xlsx support
- openpyxl directly — More verbose than pandas

### LLM Integration
**Use:** `llm_provider.py` wrapper from S01
- Provider-agnostic
- Automatic fallback
- Retry logic built-in
- JSON Schema strict mode

**Don't use:**
- Direct OpenAI SDK calls — Loses fallback
- Separate code paths per provider — Duplicates logic

## Risks and Unknowns

### PDF Table Extraction Quality
**Risk:** pdfplumber may mis-extract tables from complex PDF layouts
**Mitigation:** LLM can handle dirty markdown; system prompt handles inconsistent formatting

### Large File Handling
**Risk:** Very large PDF/Excel files may exceed memory or LLM token limits
**Mitigation:** Current implementation processes full file; consider chunking for production
**Decision:** Out of scope for S03 — handle per-need in future

### Price Field Extraction
**Risk:** LLM may not extract unit_price/total_price (not in current InvoiceItem schema)
**Current state:** invoice_parser.py defaults prices to 0 if not in LLM output
**Decision:** Add unit_price/total_price to LLM schema in S03

## Verification

### Unit Test Verification
```bash
cd backend && python -m pytest tests/test_invoice_parser.py -v
```
Expected: 10+ tests pass with >80% coverage

### Integration Test Verification
```bash
cd backend && python -m pytest tests/test_s03_integration.py -v
```
Expected: All integration tests pass with mock LLM

### End-to-End Verification (with real LLM)
```bash
# Requires OPENAI_API_KEY set
cd backend && OPENAI_API_KEY=sk-xxx python -c "
from backend.services.invoice_parser import parse_invoice_file
with open('tests/fixtures/test_simple_invoice.pdf', 'rb') as f:
    result = parse_invoice_file('test.pdf', f.read())
    print(f'Status: {result[\"status\"]}')
    print(f'Items: {len(result[\"items\"])}')
"
```
Expected: Successful extraction with >0 items

### Dependency Verification
```bash
grep pdfplumber backend/requirements.txt
```
Expected: `pdfplumber==0.11.4` present

## Sources

- pdfplumber docs: https://github.com/jsvine/pdfplumber
- pandas Excel docs: https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html
- OpenAI JSON Schema: https://platform.openai.com/docs/guides/structured-outputs
- S01 deliverable: backend/llm_provider.py (provider-agnostic wrapper)
- S02 deliverable: backend/email_worker.py (parse_invoice task publication)
