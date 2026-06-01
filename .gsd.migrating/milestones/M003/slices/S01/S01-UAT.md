# S01: Database Schema + LLM Provider Foundation — UAT

**Milestone:** M003
**Written:** 2026-06-01T13:40:49.044Z

# S01 UAT: Database Schema + LLM Provider Foundation

## Preconditions

1. PostgreSQL database available for migration
2. Python 3.12+ with virtual environment activated
3. Environment variables configured in `.env`
4. Docker and Docker Compose installed

## UAT Type
Integration UAT - Verifies database schema changes and LLM provider integration

## Test Cases

### TC01: Verify Migration Applied Successfully
**Steps:**
1. Run `alembic upgrade head`
2. Connect to PostgreSQL database
3. Run `\d invoices` to verify new columns
4. Run `\d invoice_items` to verify new table

**Expected Outcomes:**
- invoices table has raw_file column of type BYTEA
- invoices table has verification_result column of type JSONB
- invoice_items table exists with columns: id, invoice_id, project_item_id, name, sku, qty, unit_price, total_price, created_at
- Foreign keys fk_invoice_items_invoice and fk_invoice_items_project_item exist

**Edge Cases:**
- Migration is idempotent (running twice has no effect)
- Downgrade removes all changes cleanly

### TC02: Verify LLM Provider Configuration
**Steps:**
1. Check `.env` contains LLM configuration
2. Run `docker compose config | grep LLM_`
3. Verify celery-worker and telegram-bot services have LLM variables

**Expected Outcomes:**
- .env contains LLM_PRIMARY_PROVIDER, LLM_SECONDARY_PROVIDER, and API keys
- docker-compose.yml references environment variables with defaults
- Both services inherit LLM configuration

### TC03: Verify LLM Provider Factory
**Steps:**
1. Import llm_provider module
2. Call `create_provider("openai")` with API key
3. Verify OpenAIProvider instance returned
4. Repeat for "anthropic" and "gemini"

**Expected Outcomes:**
- Factory returns correct provider instance for each type
- Case-insensitive provider names work
- Invalid provider names raise ValueError with available options

### TC04: Verify Fallback Logic
**Steps:**
1. Create LLMProvider with primary=OpenAI, secondary=Anthropic
2. Mock OpenAI to raise RateLimitError
3. Call provider.call()
4. Verify Anthropic called as fallback

**Expected Outcomes:**
- Primary provider attempted first
- On rate limit error, secondary provider called
- No fallback on non-retryable errors (auth, validation)

### TC05: Verify Invoice Parsing
**Steps:**
1. Create sample invoice table as markdown
2. Call `parse_invoice_structure(table_text)`
3. Verify returned dict has items list
4. Verify InvoiceItem Pydantic model validates

**Expected Outcomes:**
- Function returns structured dict with items, metadata
- Each item has sku, name, qty fields
- Empty/whitespace input raises ValueError

## Not Proven By This UAT

- Real API calls to OpenAI/Anthropic/Gemini (external services mocked in tests)
- PostgreSQL migration execution on live database (verified via SQL generation only)
- Docker container startup with new environment variables
- Integration with S03 IMAP ingest (next slice)

## Verification Artifacts

- Migration SQL: `backend/alembic/versions/4773ecad7cb2_invoice_extensions.py`
- Test results: 53 total tests pass (20 model tests + 33 LLM provider tests)
- Configuration files: `.env`, `docker-compose.yml`
