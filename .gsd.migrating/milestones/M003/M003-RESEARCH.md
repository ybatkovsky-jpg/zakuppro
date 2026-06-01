# M003 — Research: Email + Invoice Processing

**Date:** 2026-06-01

## Summary

M003 adds **IMAP ingest, PDF/Excel invoice parsing, LLM-based verification with fuzzy matching, and email notifications** to the existing ZakupPro system. The milestone builds on M002's Celery + RabbitMQ infrastructure and Telegram bot, extending the automation from purchase request creation → **invoice receipt → verification → storage**.

Primary recommendation: Use **imap-tools** library for IMAP ingestion (high-level wrapper over imaplib), **provider-agnostic LLM wrapper** with fallback for parsing (reuse existing GPT-4o pattern), **RapidFuzz** for fuzzy matching SKUs/names, and store original files as BLOB in PostgreSQL's `Invoice.raw_file` column (already exists in schema).

## Recommendation

### What Approach to Take

1. **IMAP Ingestion**: Create `email-worker` Docker service with imap-tools polling `invoices@company.com`. Use Celery Beat for scheduled polling or long-running IMAP IDLE loop. Parse sender email → identify Supplier → extract attachments → publish parse task.

2. **Invoice Parsing**: Extend existing `ai_agent.py` pattern to create `invoice_parser.py` with provider-agnostic wrapper. Parse PDF/Excel → extract structured line items (sku, name, qty, price). Use LLM with json_schema for dirty tables (already proven in M002). 3 retry attempts with exponential backoff.

3. **Verification Logic**: Create `invoice_verifier.py` with fuzzy matching using RapidFuzz. Compare invoice items against ProjectItems by purchase_order. Logic: sku matches → OK; sku differs + name similarity >85% → clarification flow; quantity differs → flag; extra/missing items → partial success.

4. **BLOB Storage**: Add `raw_file` (LargeBinary) column to `invoices` table via migration. Store original PDF/Excel for audit trail. Extracted structured data in `raw_text` (already exists).

5. **LLM Provider Fallback**: Create `llm_provider.py` wrapper supporting OpenAI, Gemini, Claude. Configuration-driven primary/secondary providers. Auto-fallback on rate limit/timeout errors.

6. **Interactive Clarification**: Extend Telegram bot with conversation state. When verification needs clarification, send message to supplier's email (SMTP) and await reply. User can also respond via Telegram for manual resolution.

7. **Notifications**: Extend `telegram_notifier.py` with invoice-specific messages (success/partial/failure). Add SMTP email notifications for clarification requests.

### Why This Approach

- **imap-tools** over raw imaplib: Higher-level API, handles connection pooling, message parsing, attachment extraction. Avoids re-inventing IMAP complexity.
- **Reuse M002 LLM pattern**: `ai_agent.py` already has proven retry logic, json_schema validation, Pydantic models. Extend rather than rewrite.
- **RapidFuzz over FuzzyWuzzy**: Faster (C++ implementation), active maintenance, better Python 3.12+ support.
- **BLOB in PostgreSQL**: Audit trail requires original files. Database simplifies backup/restore vs filesystem. PostgreSQL BYTEA handles files up to 1GB.
- **Provider-agnostic wrapper**: GPT-4o-mini for primary (cheap), Gemini 2.5 Flash fallback (cheaper), Claude Sonnet backup. Fallback ensures continuity.
- **Celery for email worker**: Reuse existing RabbitMQ infrastructure. Single queue for all async tasks.

## Implementation Landscape

### Key Files

- **backend/models.py** — Add `Invoice.raw_file: LargeBinary` column for BLOB storage. Add `Invoice.verification_result: JSONB` for structured verification output. Add `InvoiceItem` model for line items if not exists.
- **backend/celery_app.py** — Add `email_queue` for invoice processing tasks.
- **backend/tasks.py** — Add `process_invoice_email`, `parse_invoice`, `verify_invoice` Celery tasks.
- **backend/invoice_parser.py** — NEW: LLM-based invoice extraction (extend `ai_agent.py` pattern).
- **backend/invoice_verifier.py** — NEW: Fuzzy matching verification logic using RapidFuzz.
- **backend/email_worker.py** — NEW: IMAP polling loop with imap-tools.
- **backend/llm_provider.py** — NEW: Provider-agnostic LLM wrapper with fallback.
- **backend/telegram_notifier.py** — Extend with invoice notification functions.
- **backend/email_notifier.py** — NEW: SMTP email sending for clarification requests.
- **docker-compose.yml** — Add `email-worker` service.
- **backend/alembic/versions/** — Add migration for Invoice.raw_file, InvoiceItem table.
- **.env** — Add IMAP credentials, SMTP credentials, LLM provider config.

### Build Order

1. **S01: Database Schema + LLM Provider Foundation** — Add Invoice.raw_file migration, InvoiceItem table, llm_provider.py wrapper. Unblocks BLOB storage and provider switching.
2. **S02: IMAP Ingest + Email Worker Service** — Create email_worker.py with imap-tools, add docker-compose service. Unlocks incoming invoice capture.
3. **S03: Invoice Parsing with LLM** — Create invoice_parser.py extending ai_agent.py pattern, add parse_invoice task. Unblocks structured data extraction.
4. **S04: Verification Logic + Fuzzy Matching** — Create invoice_verifier.py with RapidFuzz, add verify_invoice task. Unblocks invoice-to-order matching.
5. **S05: Notifications + Clarification Flow** — Extend telegram_notifier.py, add email_notifier.py with SMTP, implement clarification conversation state. Unblocks user-facing outcomes.
6. **S06: Integration + End-to-End Testing** — Full flow test with real email messages, LLM mock for tests, fixtures for dirty invoices.

### Verification Approach

- Unit tests for `invoice_verifier.py` fuzzy matching (sku match, name similarity, quantity diff)
- Integration tests with test IMAP mailbox (mailcatcher/imapmock)
- LLM mock for `invoice_parser.py` tests (avoid API costs)
- Test fixtures for dirty PDF/Excel invoices (merged cells, multi-line headers)
- End-to-end test: send test email → email_worker ingests → parse → verify → store → notify
- Coverage >80% for new modules

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| IMAP connection handling | imap-tools (PyPI) | High-level API, connection pooling, attachment parsing, handles IDLE |
| Fuzzy string matching | RapidFuzz | C++ implementation (fast), Python 3.12+ compatible, active maintenance |
| LLM provider abstraction | LiteLLM (BerriAI/litellm) | Unified API for 100+ providers, built-in fallback support |
| Email templates | Jinja2 | Industry standard for templating, supports HTML/plain text |
| PDF text extraction | PyMuPDF (fitz) | Fast, robust, handles scanned documents with OCR integration |
| Excel parsing | pandas (already used) | Proven in M002, handles dirty tables well |

## Constraints

- **SQLAlchemy 2.0 patterns**: Use `relationship(back_populates=...)` not backref, `lazy="selectin"` for one-to-many.
- **Pydantic v2**: Use `model_config = ConfigDict(from_attributes=True)` for ORM mode.
- **Celery + RabbitMQ**: Reuse existing broker, queues, DLQ infrastructure.
- **Telegram bot v21+**: python-telegram-bot async API, existing handlers pattern.
- **PostgreSQL BYTEA limits**: 1GB max per file, use LargeBinary (unbounded in SQLAlchemy maps to BYTEA).
- **Docker Compose networking**: Services communicate by service name (db, rabbitmq).

## Common Pitfalls

- **IMAP connection leaks**: Always logout/close IMAP connections, use context managers in imap-tools.
- **BLOB memory bloat**: Stream files to DB in chunks, don't load entire file into memory.
- **LLM rate limits**: Implement exponential backoff with jitter (2^retry + random), respect 429 responses.
- **Fuzzy matching false positives**: Set similarity threshold >85%, verify with sku match first.
- **Email parsing errors**: Not all emails have attachments, handle missing Content-Disposition gracefully.
- **Celery task idempotency**: Invoice processing should be idempotent (duplicate messages, retries).

## Open Risks

- **LLM cost at scale**: Invoice parsing may require GPT-4o for complex tables. Mitigation: try GPT-4o-mini first, fallback only on failure.
- **Scanned PDF OCR**: Native PDF extraction fails on scanned documents. Mitigation: add pytesseract/Tesseract OCR as optional dependency in S04.
- **Dirty Excel formats**: Suppliers use inconsistent layouts. Mitigation: LLM prompt with extensive column mapping examples.
- **Clarification flow UX**: Supplier may not respond to clarification emails. Mitigation: manual resolution UI in M005.
- **BLOB storage growth**: Invoice files accumulate. Mitigation: archive old invoices to cold storage, implement retention policy.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| IMAP/Email processing | imap-tools (https://pypi.org/project/imap-tools/) | Available |
| Fuzzy matching | RapidFuzz | Available |
| LLM provider abstraction | LiteLLM (BerriAI/litellm) | Available |
| PDF extraction | PyMuPDF (fitz) | Available |
| OCR for scanned PDFs | pytesseract/Tesseract | Available |

## Sources

- [imap-tools PyPI](https://pypi.org/project/imap-tools/) — High-level IMAP library for Python
- [Python OCR Library Comparison 2026](https://codesota.com/ocr/best-for-python) — PaddleOCR, Tesseract, RapidOCR comparison
- [Fuzzy Matching of Product Names - Stack Overflow](https://stackoverflow.com/questions/595250/fuzzy-matching-of-product-names) — Product name matching approaches
- [Fuzzy String Matching in Python - DataCamp](https://www.datacamp.com/tutorial/fuzzy-string-python) — Levenshtein distance tutorial
- [LLM Provider Fallback Pattern](https://github.com/BerriAI/litellm) — LiteLLM unified API for multi-provider
- [imaplib Python Documentation](https://docs.python.org/3/library/imaplib.html) — Official IMAP client docs
- [RapidFuzz GitHub](https://github.com/maxbachmann/RapidFuzz) — Fast fuzzy string matching
