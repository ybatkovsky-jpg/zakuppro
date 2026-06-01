---
estimated_steps: 46
estimated_files: 1
skills_used: []
---

# T03: Create Celery Task for Excel Parsing

## Why
Wire Excel parser and AI agent into Celery task. Task receives file_path from S02's queue_excel_processing, executes parsing pipeline, returns structured JSON. Failed tasks go to DLQ for inspection.

## Do
1. Add `parse_excel_bom` task to `backend/tasks.py`:
   - Task name: `tasks.parse_excel_bom`
   - Signature: `bind=True, max_retries=2`
   - Parameters: `file_path: str, chat_id: int`
   - Returns: dict with `{status, items_count, items, metadata, task_id}`

2. Task workflow:
   ```python
   try:
     df = read_excel_file(file_path)
     df_clean = clean_dataframe(df)
     markdown = dataframe_to_markdown(df_clean)
     extracted = extract_bom_structure(markdown)
     validated = ExtractedBOM.model_validate(extracted)
     return {
       'status': 'success',
       'items_count': len(validated.items),
       'items': [i.model_dump() for i in validated.items],
       'metadata': validated.metadata or {},
       'task_id': self.request.id
     }
   except RateLimitError as e:
     raise self.retry(exc=e, countdown=2**self.request.retries, max_retries=2)
   except ValueError:  # Validation error
     raise  # Moves to DLQ
   except Exception as e:
     logger.error(...)
     raise  # Moves to DLQ
   ```

3. Import new modules at top of tasks.py:
   ```python
   from backend.excel_parser import read_excel_file, clean_dataframe, dataframe_to_markdown
   from backend.ai_agent import extract_bom_structure, ExtractedBOM
   ```

4. Logging at each step:
   - INFO: Excel file read, row count
   - INFO: AI extraction started/finished
   - WARNING: Retry triggered
   - ERROR: Validation failure with details

## Constraints
- Task name MUST be `tasks.parse_excel_bom` for S04 integration
- max_retries=2 (after 3 total attempts, task goes to DLQ)
- Use existing DLQ configuration from celery_app.py
- Return JSON-serializable dict (no Pydantic objects in result)

## Inputs

- `backend/excel_parser.py`
- `backend/ai_agent.py`
- `backend/celery_app.py`

## Expected Output

- `backend/tasks.py`

## Verification

grep -q "parse_excel_bom" backend/tasks.py && python -c "from backend.tasks import parse_excel_bom; print('Task registered:', parse_excel_bom.name)"
