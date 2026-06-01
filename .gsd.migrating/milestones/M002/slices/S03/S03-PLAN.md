# S03: Excel Parsing + AI-Agent

**Goal:** Create Celery task that parses Excel files with pandas and extracts structured BOM data using OpenAI GPT-4o for dirty table recognition. Task receives file_path from S02's queue_excel_processing and returns JSON with items (sku, name, qty, supplier).
**Demo:** Celery task парсит Excel с pandas, вызывает GPT-4o для распознавания структуры, возвращает JSON с данными

## Must-Haves

- Celery task `parse_excel_bom` registered and executable
- Excel reading with pandas handles dirty tables (merged cells, multi-line headers)
- OpenAI GPT-4o extracts structure with JSON schema validation
- Pydantic models validate response (BOMItem, ExtractedBOM)
- Retry with exponential backoff for rate limits (1s, 2s, 4s)
- Failed tasks move to DLQ after max_retries

## Proof Level

- This slice proves: integration

## Integration Closure

Upstream: Consumes RabbitMQ (S01), file paths from S02's queue_excel_processing task.
Wiring: New Celery task registered in backend/tasks.py, callable by task name. S04 will use this task output for Project creation.
What remains: S04 will wire this task's JSON output into FastAPI Project endpoints.

## Verification

- Structured logging: Excel read success/row counts, AI token usage, extraction results
- Task state: retry_count visible in logs, DLQ preserves full error context
- Failure signals: OpenAI rate limits, invalid JSON, validation errors logged with traceback

## Tasks

- [x] **T01: Create Excel Parser Module** `est:30m`
  ## Why
  Create reusable Excel reading utilities for dirty invoice tables. Pandas reads raw data; cleanup logic handles merged cells, empty rows, and multi-line headers. This module produces clean CSV for AI processing.
  - Files: `backend/excel_parser.py`
  - Verify: python -c "from backend.excel_parser import read_excel_file, clean_dataframe, dataframe_to_markdown; print('Module loads successfully')"

- [x] **T02: Create AI Agent Module with OpenAI Integration** `est:1h`
  ## Why
  OpenAI GPT-4o recognizes dirty table structure and maps Russian column names to standard English fields (sku, name, qty, supplier). JSON schema guarantees 100% valid output format.
  - Files: `backend/ai_agent.py`
  - Verify: python -c "from backend.ai_agent import extract_bom_structure, ExtractedBOM; print('AI agent module loads')"

- [x] **T03: Create Celery Task for Excel Parsing** `est:45m`
  ## Why
  Wire Excel parser and AI agent into Celery task. Task receives file_path from S02's queue_excel_processing, executes parsing pipeline, returns structured JSON. Failed tasks go to DLQ for inspection.
  - Files: `backend/tasks.py`
  - Verify: grep -q "parse_excel_bom" backend/tasks.py && python -c "from backend.tasks import parse_excel_bom; print('Task registered:', parse_excel_bom.name)"

- [ ] **T04: Create Test Excel and Verify Task End-to-End** `est:30m`
  ## Why
  Prove the complete pipeline works: Excel file → Celery task → AI extraction → JSON output. Test file validates dirty table handling (merged cells, Russian columns).
  - Files: `tests/fixtures/sample_bom.xlsx`, `backend/tests/test_s03_integration.py`
  - Verify: test -f tests/fixtures/sample_bom.xlsx && python -c "from backend.tasks import parse_excel_bom; from backend.excel_parser import read_excel_file; from backend.ai_agent import extract_bom_structure; print('✓ S03 integration test: all modules import successfully')"

## Files Likely Touched

- backend/excel_parser.py
- backend/ai_agent.py
- backend/tasks.py
- tests/fixtures/sample_bom.xlsx
- backend/tests/test_s03_integration.py
