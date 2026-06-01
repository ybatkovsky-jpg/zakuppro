---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T04: Extend integration tests with mock LLM responses

Extend backend/tests/test_s03_integration.py to test the full parse_invoice Celery task pipeline with mock LLM responses. Tests must cover: full task execution with mocked LLMProvider, Invoice BLOB storage verification, InvoiceItem creation with Decimal prices, supplier auto-creation from email metadata, and FailedTask DLQ handling on errors. Use pytest fixtures for database and mock LLM to avoid real API calls.

## Inputs

- `backend/tests/test_s03_integration.py`
- `backend/tasks.py`
- `backend/services/invoice_parser.py`

## Expected Output

- `backend/tests/test_s03_integration.py`

## Verification

cd D:/CLAUDE/Project/zakuppro/zakuppro/backend && python -m pytest tests/test_s03_integration.py -v --tb=short
