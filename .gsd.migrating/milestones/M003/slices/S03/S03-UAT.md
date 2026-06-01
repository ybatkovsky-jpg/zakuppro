# S03: Invoice Parsing with LLM — UAT

**Milestone:** M003
**Written:** 2026-06-01T15:05:42.903Z

# S03: Invoice Parsing with LLM — User Acceptance Testing

## UAT Type
**Integration Testing** — Verifies the complete invoice parsing pipeline from file input to database persistence

## Preconditions
1. Docker services running: RabbitMQ, PostgreSQL, Celery worker
2. Backend environment configured with .env (LLM API keys optional for mocked tests)
3. Database migrated with Invoice.raw_file (BYTEA) and InvoiceItem table
4. pdfplumber==0.11.4 installed in backend/requirements.txt

## Test Cases

### TC1: PDF Invoice Parsing
**Steps:**
1. Run `pytest tests/test_invoice_parser.py -k "test_pdf" -v`
2. Observe all PDF parsing tests pass

**Expected Outcome:**
- PDF text extraction works with mocked pdfplumber
- Tables converted to markdown format for LLM
- LLM returns structured ExtractedInvoice with items

**Result:** ✅ PASS — 6 PDF-related tests pass

### TC2: Excel Invoice Parsing
**Steps:**
1. Run `pytest tests/test_invoice_parser.py -k "test_excel" -v`
2. Observe all Excel parsing tests pass

**Expected Outcome:**
- Excel reading works with mocked pandas
- Multi-sheet handling extracts data from first sheet
- Empty sheets handled gracefully

**Result:** ✅ PASS — 5 Excel-related tests pass

### TC3: Full Pipeline Integration
**Steps:**
1. Run `pytest tests/test_s03_integration.py -v`
2. Observe all 12 integration tests pass

**Expected Outcome:**
- parse_invoice task processes PDF file
- Invoice record created with raw_file BLOB
- InvoiceItem records created with Decimal prices
- Supplier auto-created from email metadata
- FailedTask record created on error (DLQ)

**Result:** ✅ PASS — All 12 integration tests pass

### TC4: Error Handling
**Steps:**
1. Run `pytest tests/test_invoice_parser.py::TestErrorHandling -v`
2. Run `pytest tests/test_s03_integration.py::TestErrorHandling -v`

**Expected Outcome:**
- Rate limit errors return appropriate error status
- Unsupported formats raise ValueError
- Transient errors propagate for retry
- Non-retryable errors handled gracefully

**Result:** ✅ PASS — All error handling tests pass

## Edge Cases Tested

| Case | Description | Result |
|------|-------------|--------|
| Empty items | LLM returns no items | ✅ Flagged appropriately |
| Null metadata | LLM returns None metadata | ✅ Handled gracefully |
| Empty filename | Parse called with empty string | ✅ Returns error status |
| Case insensitive | .PDF and .pdf both work | ✅ Extension normalized |
| Multi-sheet Excel | Excel with 3+ sheets | ✅ First sheet used |
| Merged cells | Excel with merged headers | ✅ Handled by pandas |

## Not Proven By This UAT
- Real PDF file parsing (tests use mocked pdfplumber)
- Real Excel file parsing (tests use mocked pandas)
- Real LLM API calls (tests use mocked responses)
- End-to-end flow with actual IMAP email (covered in S06)

## UAT Summary
**Overall Result:** ✅ PASS

All unit tests (50) and integration tests (12) pass successfully. The invoice parsing service is ready for integration with the email-worker in S06.
