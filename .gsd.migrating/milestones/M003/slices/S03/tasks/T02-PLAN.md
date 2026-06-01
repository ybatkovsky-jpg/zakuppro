---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Create unit tests for invoice_parser.py service

Create backend/tests/test_invoice_parser.py with comprehensive unit tests for the InvoiceParser service. Tests must mock external dependencies (LLMProvider, pdfplumber, pandas) to avoid real file I/O and API calls. Cover: factory function creation, Excel/PDF parsing with mock LLM, unsupported format errors, transient error propagation, non-retryable error handling, PDF table-to-markdown conversion, Excel multi-sheet extraction, empty file handling, and metadata passing.

## Inputs

- `backend/services/invoice_parser.py`
- `backend/llm_provider.py`

## Expected Output

- `backend/tests/test_invoice_parser.py`

## Verification

cd D:/CLAUDE/Project/zakuppro/zakuppro/backend && python -m pytest tests/test_invoice_parser.py -v --tb=short
