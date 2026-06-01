---
estimated_steps: 28
estimated_files: 1
skills_used: []
---

# T04: Implement Main Orchestration Task

## Why
The end-to-end flow (R004) requires a Celery task that chains Excel parsing, database operations, and Telegram notifications. This is the core integration piece.

## Do
1. Add `process_bom_to_project(file_path, chat_id)` task to `backend/tasks.py`:
   - Use @app.task(bind=True, max_retries=2)
   - Call parse_excel_bom(file_path, chat_id) via `.apply()` for blocking execution
2. Extract items and metadata from result
3. Create SessionLocal() for database operations
4. Create Supplier records via find_or_create_supplier for each unique supplier name
5. Create Project record:
   - name: from metadata.project_name or fallback to file stem
   - client: from metadata.client or "Не указан"
   - status: default "Проектирование"
6. Create ProjectItem records for each extracted item:
   - Map supplier_id from resolved suppliers
   - Set project_id from created project
   - Use status "К закупке"
7. Send Telegram completion message with statistics
8. Return dict with project_id, items_count, reserved_count
9. Wrap steps 3-7 in try/except:
   - On error: create FailedTask record, send_dlq_alert, re-raise
   - Ensure db.close() in finally block
10. Use exponential backoff retry for transient errors

## Done when
- Task executes without errors
- Project and ProjectItem records created in DB
- Telegram message sent to user
- FailedTasks populated on error

## Inputs

- `backend/tasks.py`
- `backend/models.py`
- `backend/database.py`
- `backend/supplier_resolver.py`
- `backend/telegram_notifier.py`
- `backend/ai_agent.py`
- `backend/excel_parser.py`

## Expected Output

- `backend/tasks.py`

## Verification

grep -q 'process_bom_to_project' backend/tasks.py
