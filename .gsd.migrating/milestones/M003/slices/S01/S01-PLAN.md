# S01: Database Schema + LLM Provider Foundation

**Goal:** Extend database schema for invoice storage and create provider-agnostic LLM wrapper with fallback mechanism
**Demo:** Create migration adding Invoice.raw_file (BYTEA), Invoice.verification_result (JSONB), InvoiceItem table. LLM provider wrapper successfully makes test call to configured provider with fallback.

## Must-Haves

- Migration runs successfully and adds raw_file BYTEA column, InvoiceItem table with line items, verification_result JSONB column. llm_provider.py wrapper supports OpenAI, Gemini, Claude with configuration-driven primary/secondary. Fallback test passes: primary API fails → secondary API succeeds.

## Proof Level

- This slice proves: Integration — migration applied to PostgreSQL and LLM wrapper makes real API call with fallback

## Integration Closure

Database models updated with new columns and relationships. llm_provider.py provides parse_invoice() callable for S03. Configuration via .env with LLM_PRIMARY_PROVIDER, LLM_SECONDARY_PROVIDER.

## Verification

- Migration log shows schema changes. LLM wrapper logs provider selection and fallback events with structured logging.

## Tasks

- [x] **T01: Create Alembic migration for Invoice.raw_file, Invoice.verification_result, InvoiceItem table** `est:30m`
  Generate Alembic migration to add BYTEA column for BLOB storage, JSONB column for verification results, and InvoiceItem table for line items with foreign keys to Invoice and ProjectItem.
  - Files: `backend/alembic/versions/*_add_invoice_blobs.py`, `backend/models.py`
  - Verify: alembic upgrade head && psql -c "\d invoices" && psql -c "\d invoice_items"

- [x] **T02: Create llm_provider.py with provider-agnostic wrapper** `est:1h`
  Create backend/llm_provider.py with LLMProvider class supporting OpenAI, Gemini, Claude. Configuration-driven primary/secondary from .env. Fallback logic on rate limit/timeout errors. parse_invoice() method accepting file content and schema.
  - Files: `backend/llm_provider.py`, `.env`
  - Verify: pytest backend/tests/test_llm_provider.py -v

- [x] **T03: Add LLM provider configuration to .env and docker-compose.yml** `est:15m`
  Add LLM_PRIMARY_PROVIDER (openai/gemini/claude), LLM_SECONDARY_PROVIDER, and respective API keys to .env. Mount .env to celery-worker and telegram-bot services in docker-compose.yml.
  - Files: `.env`, `docker-compose.yml`
  - Verify: grep LLM_ .env && docker compose config | grep LLM_

- [x] **T04: Write unit tests for LLM provider with fallback** `est:45m`
  Create backend/tests/test_llm_provider.py with tests for successful call, primary failure with fallback, all providers fail, retry logic with exponential backoff. Mock external APIs.
  - Files: `backend/tests/test_llm_provider.py`
  - Verify: pytest backend/tests/test_llm_provider.py -v --cov=backend/llm_provider

## Files Likely Touched

- backend/alembic/versions/*_add_invoice_blobs.py
- backend/models.py
- backend/llm_provider.py
- .env
- docker-compose.yml
- backend/tests/test_llm_provider.py
