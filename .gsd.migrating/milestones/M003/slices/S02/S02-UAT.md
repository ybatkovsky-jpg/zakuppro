# S02: IMAP Ingest + Email Worker Service — UAT

**Milestone:** M003
**Written:** 2026-06-01T13:57:41.706Z

## S02 UAT: IMAP Ingest + Email Worker Service

### Test Scenario 1: Service Startup
1. Configure .env with IMAP credentials
2. Start email-worker: `docker-compose up email-worker`
3. **Expected:** Service starts, connects to IMAP, begins polling

### Test Scenario 2: Email Processing
1. Send test email with PDF attachment to configured mailbox
2. Wait for poll interval (60s)
3. **Expected:** Email fetched, attachment extracted, parse_invoice task published

### Test Scenario 3: Duplicate Detection
1. Send same email twice
2. **Expected:** Second email skipped (Message-ID already processed)

### Test Scenario 4: Graceful Shutdown
1. Send SIGTERM to email-worker
2. **Expected:** Service exits cleanly, prints statistics

### Manual Verification Steps
```bash
# Check service is running
docker ps | grep email-worker

# View logs for processing activity
docker-compose logs email-worker | grep -i "processed\|published"

# Check processed IDs file
docker exec zakuppro-email-worker cat /data/processed_message_ids.txt
```

### Integration with S03
When S03 implements parse_invoice task:
- Attachments will be parsed with LLM
- Extracted data will be stored in InvoiceItem table
- Verification results in Invoice.verification_result JSONB
