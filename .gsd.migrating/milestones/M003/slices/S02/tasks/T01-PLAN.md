---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T01: IMAP Client Module

Create backend/services/imap_client.py with IMAPClient class for connecting to IMAP server, listing unread emails, fetching email content, and extracting attachments. Support for connection pooling, SSL/TLS, and retry logic with exponential backoff. Handle IMAP IDLE for real-time notification if supported.

## Inputs

- `IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS from .env`
- `imaplib Python library documentation`

## Expected Output

- `IMAPClient class with connect(), fetch_emails(), extract_attachments(), disconnect() methods`
- `Unit tests with mocked IMAP server`
- `Error handling for connection failures and authentication errors`

## Verification

cd backend && python -m pytest tests/test_imap_client.py -v
