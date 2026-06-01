---
estimated_steps: 20
estimated_files: 2
skills_used: []
---

# T04: Create Test Excel and Verify Task End-to-End

## Why
Prove the complete pipeline works: Excel file → Celery task → AI extraction → JSON output. Test file validates dirty table handling (merged cells, Russian columns).

## Do
1. Create test Excel file `tests/fixtures/sample_bom.xlsx` with:
   - Russian column headers (Артикул, Наименование, Количество, Поставщик)
   - 5-10 sample rows
   - One empty row (to test cleanup)
   - Optional: multi-line header or merged cell

2. Create verification script `backend/tests/test_s03_integration.py`:
   - Reads test Excel
   - Calls parse_excel_bom.delay() or apply_async()
   - Waits for result with timeout
   - Asserts: status=success, items_count > 0, items have sku/name/qty

3. Manual verification (if Docker not running):
   - `python -c "from backend.excel_parser import *; from backend.ai_agent import *; print('Modules load')"
   - Check imports succeed

## Constraints
- Test file MUST use Russian headers (real-world validation)
- Verification MUST check task registration and module imports
- If OPENAI_API_KEY is not set, verification should pass module import tests only (skip API call)

## Inputs

- `backend/tasks.py`
- `backend/excel_parser.py`
- `backend/ai_agent.py`

## Expected Output

- `tests/fixtures/sample_bom.xlsx`
- `backend/tests/test_s03_integration.py`

## Verification

test -f tests/fixtures/sample_bom.xlsx && python -c "from backend.tasks import parse_excel_bom; from backend.excel_parser import read_excel_file; from backend.ai_agent import extract_bom_structure; print('✓ S03 integration test: all modules import successfully')"
