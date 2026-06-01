# S03: S03: Excel Parsing + AI-Agent — UAT

**Milestone:** M002
**Written:** 2026-06-01T11:12:07.994Z

# UAT: S03 Excel Parsing + AI-Agent

## Preconditions
- Docker Compose services running: RabbitMQ, Celery worker
- OPENAI_API_KEY environment variable set with GPT-4o access
- Test Excel file available at `tests/fixtures/sample_bom.xlsx`

## UAT Type
Integration UAT — Verifies end-to-end Excel to JSON pipeline

## Test Steps

### 1. Module Import Verification
```bash
python -c "from backend.excel_parser import read_excel_file, dataframe_to_markdown; from backend.ai_agent import extract_bom_structure; from backend.tasks import parse_excel_bom; print('✓ All modules import successfully')"
```
**Expected:** No import errors

### 2. Excel File Reading
```bash
python -c "
from backend.excel_parser import read_excel_file
df = read_excel_file('tests/fixtures/sample_bom.xlsx')
print(f'Rows read: {len(df)}')
print(f'Columns: {list(df.columns)}')
"
```
**Expected:** Rows read: ≥10, Columns include Russian headers

### 3. Markdown Conversion
```bash
python -c "
from backend.excel_parser import read_excel_file, dataframe_to_markdown
df = read_excel_file('tests/fixtures/sample_bom.xlsx')
md = dataframe_to_markdown(df)
print(f'Markdown length: {len(md)} chars')
print(md[:200])
"
```
**Expected:** Markdown length > 0, table format visible

### 4. AI BOM Extraction (requires OPENAI_API_KEY)
```bash
cd backend && python -c "
from ai_agent import extract_bom_structure
result = extract_bom_structure('| Артикул | Наименование | ...')
print(f'Items extracted: {result[\"items_count\"]}')
print(result)
"
```
**Expected:** JSON with `items` array containing sku, name, qty, supplier fields

### 5. Celery Task Execution (via RabbitMQ)
```bash
# Publish task to RabbitMQ
from backend.tasks import parse_excel_bom
result = parse_excel_bom.delay('tests/fixtures/sample_bom.xlsx', chat_id=123)
print(f'Task ID: {result.id}')
print(f'Status: {result.status}')
```
**Expected:** Task executes successfully, returns dict with status="success"

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| Empty rows | Dropped via `clean_dataframe()` |
| Merged cells | Pandas openpyxl fills forward |
| Russian column names | GPT-4o maps to English fields |
| Rate limits | Exponential backoff retry (1s, 2s, 4s) |
| Invalid JSON | APIResponseValidationError → DLQ |
| Missing columns | LLM maps flexibly, null for missing |

## Not Proven By This UAT

- S04 integration: Task execution triggered from Telegram bot flow
- DLQ inspection: Manual verification of failed task contents
- Full Docker deployment: Runtime verification requires container environment
