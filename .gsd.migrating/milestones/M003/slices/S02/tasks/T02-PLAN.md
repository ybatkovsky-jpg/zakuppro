---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T02: Email Worker Service

Create backend/email_worker.py main service that runs as a Celery beat worker or standalone process. Polls IMAP mailbox at configurable interval (default 60s), processes new emails, extracts PDF/Excel attachments, and publishes parse_invoice tasks to RabbitMQ. Track processed emails by Message-ID to avoid duplicates. Graceful shutdown on SIGTERM.

## Inputs

- `IMAPClient from T01`
- `parse_invoice task signature (placeholder for S03)`
- `RabbitMQ connection from celery_app.py`

## Expected Output

- `email_worker.py with poll_forever() loop`
- `parse_invoice task publication with file bytes and metadata`
- `Duplicate detection by Message-ID`
- `Graceful shutdown handling`

## Verification

docker-compose up email-worker && docker-compose logs email-worker | grep -i 'processed\|published'
