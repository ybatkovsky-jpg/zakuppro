# M003: Email + Invoice Processing

**Vision:** Automatic invoice processing from suppliers via IMAP with LLM-based verification and fuzzy matching, closing the loop from purchase requests to invoice reconciliation.

## Success Criteria

- Interactive data collection works via Telegram and Email
- IMAP ingest processes incoming emails with attachments
- Parse extracts data from PDF and Excel files
- Verify matches items with fuzzy matching and flags discrepancies
- Variation aliases saved after clarification
- Telegram notifications sent for all outcomes
- LLM fallback works on primary API failure
- BLOB storage correctly saves and retrieves files
- Email-worker integrated in docker-compose.yml
- All tests pass with >80% coverage

## Slices

- [x] **S01: S01** `risk:high — BLOB storage and provider switching affect all downstream work` `depends:[]`
  > After this: Create migration adding Invoice.raw_file (BYTEA), Invoice.verification_result (JSONB), InvoiceItem table. LLM provider wrapper successfully makes test call to configured provider with fallback.

- [x] **S02: S02** `risk:medium-high — IMAP connection handling, attachment extraction uncertain` `depends:[]`
  > After this: email-worker Docker service running, connects to IMAP server, polls test mailbox, extracts PDF attachment, publishes parse_invoice task to RabbitMQ. Verify via Celery logs.

- [x] **S03: S03** `risk:medium — extends proven ai_agent.py pattern to PDF/Excel invoices` `depends:[]`
  > After this: parse_invoice Celery task receives PDF/Excel file, calls LLM via llm_provider.py, extracts structured line items (sku, name, qty, price), saves to InvoiceItem table with raw_file BLOB. Verify via database query.

- [x] **S04: S04** `risk:medium — fuzzy matching reconciliation logic is new core business logic` `depends:[]`
  > After this: invoice_verifier.py compares invoice items against ProjectItem by purchase_order. SKU matches → OK. SKU differs + RapidFuzz similarity >85% → clarification flag. Quantity differs → partial flag. Verification result saved to Invoice.verification_result JSONB.

- [x] **S05: S05** `risk:low-medium — extends existing telegram_notifier.py, adds SMTP` `depends:[]`
  > After this: Telegram notification sent on invoice verification (success/partial/failure). Clarification email sent via SMTP to supplier when fuzzy match detected. User can reply via email or Telegram to resolve.

- [x] **S06: S06** `risk:low — validates full flow` `depends:[]`
  > After this: Full flow test: send invoice email to test mailbox → IMAP ingest → parse → verify → notification. All steps execute end-to-end. Test fixtures for dirty invoices (merged cells, multi-line headers).

## Boundary Map

## External Boundaries

- **IMAP Server** — Polls `invoices@company.com` mailbox. Requires IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS.
- **SMTP Server** — Sends clarification emails. Requires SMTP_HOST, SMTP_PORT, SMTP_EMAIL, SMTP_PASSWORD.
- **Telegram Bot API** — Sends notifications. Requires TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID.
- **LLM APIs** — OpenAI, Gemini, Claude. Requires OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY.

## Internal Boundaries

- **Celery Queue** — `email_queue` for invoice processing tasks.
- **Database** — Invoice.raw_file (BYTEA), InvoiceItem table, Invoice.verification_result (JSONB).
- **File Storage** — /data/uploads volume for temporary invoice files.
- **FailedTask Table** — Captures failed parses with DLQ alerts.
