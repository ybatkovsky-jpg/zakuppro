---
estimated_steps: 1
estimated_files: 4
skills_used: []
---

# T04: Unit + Integration Tests

Write comprehensive unit tests for IMAPClient (connection, fetch, attachment extraction with mocks), email_worker (poll loop, task publication with Celery mock), and duplicate detection. Integration test with test mailbox or local IMAP server (greenmail/imapmock) verifies full flow: email with attachment → IMAP fetch → extract → Celery task publish.

## Inputs

- `pytest, pytest-cov, pytest-mock libraries`
- `Test fixtures for sample email with PDF attachment`

## Expected Output

- `Unit tests with >80% coverage for imap_client and email_worker`
- `Integration test with mocked IMAP server`
- `Test fixtures for dirty attachments (merged cells, multi-line headers)`

## Verification

cd backend && python -m pytest tests/test_imap_client.py tests/test_email_worker.py -v --cov=services.imap_client --cov=email_worker
