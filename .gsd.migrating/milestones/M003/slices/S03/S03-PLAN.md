# S03: Invoice Parsing with LLM

**Goal:** Complete invoice parsing service implementation with PDF/Excel support, comprehensive unit tests, and test fixtures
**Demo:** parse_invoice Celery task receives PDF/Excel file, calls LLM via llm_provider.py, extracts structured line items (sku, name, qty, price), saves to InvoiceItem table with raw_file BLOB. Verify via database query.

## Must-Haves

- pdfplumber dependency added to requirements.txt for PDF text extraction
- Comprehensive unit tests for invoice_parser.py service with >80% coverage
- Integration tests extended with mock LLM responses
- Test fixtures created for PDF and Excel invoice files
- All 10+ unit tests pass with proper mocking of external dependencies

## Proof Level

- This slice proves: integration

## Integration Closure

- parse_invoice Celery task already implements full pipeline (file parsing → LLM extraction → Invoice/InvoiceItem persistence → FailedTask DLQ)
- invoice_parser.py service provides PDF (pdfplumber) and Excel (pandas) extraction with LLM structured output
- llm_provider.py from S01 provides parse_invoice() callable with automatic fallback
- Database models Invoice.raw_file (BYTEA) and InvoiceItem table from S01 ready for BLOB storage
- After S03: parse_invoice task ready for end-to-end processing with real IMAP emails in S06

## Verification

- Structured logging for invoice parsing status (started, items extracted, completed, errors)
- Warning logs for empty invoice items or no text extracted
- Error logs for PDF/Excel extraction failures and LLM provider errors
- Task-level logs with task_id, filename, file_size, message_id correlation

## Tasks

- [x] **T01: Add pdfplumber dependency to requirements.txt** `est:5m`
  Add pdfplumber==0.11.4 to requirements.txt. This library is required by invoice_parser.py for PDF text extraction with table support. The invoice_parser.py service already imports and uses pdfplumber in its _extract_pdf_text() method (line 176), but the dependency is missing from requirements.txt, causing ImportError at runtime.
  - Files: `backend/requirements.txt`
  - Verify: grep -q 'pdfplumber==0.11.4' D:/CLAUDE/Project/zakuppro/zakuppro/backend/requirements.txt

- [x] **T02: Create unit tests for invoice_parser.py service** `est:1h`
  Create backend/tests/test_invoice_parser.py with comprehensive unit tests for the InvoiceParser service. Tests must mock external dependencies (LLMProvider, pdfplumber, pandas) to avoid real file I/O and API calls. Cover: factory function creation, Excel/PDF parsing with mock LLM, unsupported format errors, transient error propagation, non-retryable error handling, PDF table-to-markdown conversion, Excel multi-sheet extraction, empty file handling, and metadata passing.
  - Files: `backend/tests/test_invoice_parser.py`
  - Verify: cd D:/CLAUDE/Project/zakuppro/zakuppro/backend && python -m pytest tests/test_invoice_parser.py -v --tb=short

- [x] **T03: Create test fixtures for invoice parsing** `est:30m`
  Create backend/tests/fixtures/ directory and add test invoice files: test_simple_invoice.pdf (single-page PDF with sample table), test_dirty_invoice.xlsx (Excel with multiple sheets and merged cells for dirty table handling), and test_russian_invoice.pdf (PDF with Russian headers). These fixtures are required for integration tests and manual verification of PDF/Excel extraction.
  - Files: `backend/tests/fixtures/test_simple_invoice.pdf`, `backend/tests/fixtures/test_dirty_invoice.xlsx`, `backend/tests/fixtures/test_russian_invoice.pdf`
  - Verify: test -f D:/CLAUDE/Project/zakuppro/zakuppro/backend/tests/fixtures/test_simple_invoice.pdf && test -f D:/CLAUDE/Project/zakuppro/zakuppro/backend/tests/fixtures/test_dirty_invoice.xlsx && test -f D:/CLAUDE/Project/zakuppro/zakuppro/backend/tests/fixtures/test_russian_invoice.pdf

- [x] **T04: Extend integration tests with mock LLM responses** `est:1h`
  Extend backend/tests/test_s03_integration.py to test the full parse_invoice Celery task pipeline with mock LLM responses. Tests must cover: full task execution with mocked LLMProvider, Invoice BLOB storage verification, InvoiceItem creation with Decimal prices, supplier auto-creation from email metadata, and FailedTask DLQ handling on errors. Use pytest fixtures for database and mock LLM to avoid real API calls.
  - Files: `backend/tests/test_s03_integration.py`
  - Verify: cd D:/CLAUDE/Project/zakuppro/zakuppro/backend && python -m pytest tests/test_s03_integration.py -v --tb=short

## Files Likely Touched

- backend/requirements.txt
- backend/tests/test_invoice_parser.py
- backend/tests/fixtures/test_simple_invoice.pdf
- backend/tests/fixtures/test_dirty_invoice.xlsx
- backend/tests/fixtures/test_russian_invoice.pdf
- backend/tests/test_s03_integration.py
