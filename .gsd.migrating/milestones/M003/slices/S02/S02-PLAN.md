# S02: IMAP Ingest + Email Worker Service

**Goal:** Create email-worker Docker service that connects to IMAP server, polls for incoming emails with invoice attachments, extracts PDF/Excel files, and publishes parse_invoice tasks to RabbitMQ
**Demo:** email-worker Docker service running, connects to IMAP server, polls test mailbox, extracts PDF attachment, publishes parse_invoice task to RabbitMQ. Verify via Celery logs.

## Must-Haves

- email-worker service runs in docker-compose and connects to IMAP server
- IMAP poll logic retrieves emails and extracts PDF/Excel attachments
- parse_invoice task published to RabbitMQ with file content and metadata
- Error handling for IMAP connection failures, unsupported file types, and duplicate emails
- Unit tests for IMAP client, attachment extractor, and task publisher
- Integration test with test mailbox verifies end-to-end flow

## Proof Level

- This slice proves: Integration test with test mailbox confirms email → attachment extraction → Celery task publication flow

## Integration Closure

email-worker connects to existing RabbitMQ instance and publishes parse_invoice tasks to the existing celery-worker queue. Celery logs confirm task receipt for S03 processing.

## Verification

- Structured logging for IMAP connection status, email processing results, and task publication. Metrics for emails processed, attachments extracted, and tasks published.

## Tasks

- [x] **T01: IMAP Client Module** `est:4h`
  Create backend/services/imap_client.py with IMAPClient class for connecting to IMAP server, listing unread emails, fetching email content, and extracting attachments. Support for connection pooling, SSL/TLS, and retry logic with exponential backoff. Handle IMAP IDLE for real-time notification if supported.
  - Files: `backend/services/imap_client.py`, `backend/requirements.txt`, `backend/tests/test_imap_client.py`
  - Verify: cd backend && python -m pytest tests/test_imap_client.py -v

- [x] **T02: Email Worker Service** `est:5h`
  Create backend/email_worker.py main service that runs as a Celery beat worker or standalone process. Polls IMAP mailbox at configurable interval (default 60s), processes new emails, extracts PDF/Excel attachments, and publishes parse_invoice tasks to RabbitMQ. Track processed emails by Message-ID to avoid duplicates. Graceful shutdown on SIGTERM.
  - Files: `backend/email_worker.py`, `backend/celery_app.py`, `backend/tasks.py`
  - Verify: docker-compose up email-worker && docker-compose logs email-worker | grep -i 'processed\|published'

- [x] **T03: Docker Service Configuration** `est:2h`
  Add email-worker service to docker-compose.yml with same base image as celery-worker. Mount volumes for code and /data/uploads. Configure IMAP environment variables (IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_USE_SSL, IMAP_FOLDER, POLL_INTERVAL). Add healthcheck and restart policy. Update .env with example IMAP configuration.
  - Files: `docker-compose.yml`, `.env`, `backend/requirements.txt`
  - Verify: docker-compose config | grep -A10 'email-worker:' && docker-compose up email-worker && docker inspect $(docker ps -q --filter 'name=email-worker') | grep -i 'healthcheck'

- [x] **T04: Unit + Integration Tests** `est:4h`
  Write comprehensive unit tests for IMAPClient (connection, fetch, attachment extraction with mocks), email_worker (poll loop, task publication with Celery mock), and duplicate detection. Integration test with test mailbox or local IMAP server (greenmail/imapmock) verifies full flow: email with attachment → IMAP fetch → extract → Celery task publish.
  - Files: `backend/tests/test_imap_client.py`, `backend/tests/test_email_worker.py`, `backend/tests/fixtures/test_invoice.pdf`, `backend/requirements.txt`
  - Verify: cd backend && python -m pytest tests/test_imap_client.py tests/test_email_worker.py -v --cov=services.imap_client --cov=email_worker

## Files Likely Touched

- backend/services/imap_client.py
- backend/requirements.txt
- backend/tests/test_imap_client.py
- backend/email_worker.py
- backend/celery_app.py
- backend/tasks.py
- docker-compose.yml
- .env
- backend/tests/test_email_worker.py
- backend/tests/fixtures/test_invoice.pdf
