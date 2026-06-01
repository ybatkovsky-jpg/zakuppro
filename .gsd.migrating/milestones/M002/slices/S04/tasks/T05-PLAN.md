---
estimated_steps: 15
estimated_files: 2
skills_used: []
---

# T05: Wire Orchestration Task into Upload Flow

## Why
The upload handler currently calls queue_excel_processing which only validates files. It should call the new orchestration task to trigger the full end-to-end flow.

## Do
1. Modify `backend/tasks.py` queue_excel_processing task:
   - Instead of returning stub result, call `parse_excel_bom.delay(file_path, chat_id)`
   - Return task_id for chaining
   - Keep file validation logic intact
2. Alternative: Modify `backend/handlers/documents.py` to call `process_bom_to_project.delay()` directly instead of `queue_excel_processing.delay()`
3. Update logging to reflect new flow
4. Verify task_id is returned and displayed to user
5. Test with sample Excel file upload

## Done when
- Excel upload triggers full processing pipeline
- User receives task_id confirmation
- Celery worker logs show task execution

## Inputs

- `backend/tasks.py`
- `backend/handlers/documents.py`

## Expected Output

- `backend/tasks.py`
- `backend/handlers/documents.py`

## Verification

grep -q 'process_bom_to_project' backend/handlers/documents.py || grep -q 'parse_excel_bom.delay' backend/tasks.py
