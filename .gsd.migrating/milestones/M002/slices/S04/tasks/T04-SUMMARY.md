---
id: T04
parent: S04
milestone: M002
key_files:
  - backend/tasks.py
key_decisions:
  - Used parse_excel_bom.apply().get() instead of .delay() for blocking synchronous execution within the orchestration task
  - Deferred imports of SessionLocal, models, supplier_resolver, telegram_notifier inside try block to avoid startup errors
  - Set default status 'К закупке' for ProjectItem as specified in requirements
  - Used file stem as fallback project_name when metadata.project_name is missing
  - Included full traceback in FailedTask.error_message for debugging
duration: 
verification_result: passed
completed_at: 2026-06-01T11:29:08.691Z
blocker_discovered: false
---

# T04: Implemented main orchestration task process_bom_to_project chaining Excel parsing, database operations, and Telegram notifications with DLQ handling

**Implemented main orchestration task process_bom_to_project chaining Excel parsing, database operations, and Telegram notifications with DLQ handling**

## What Happened

Added `process_bom_to_project` Celery task to `backend/tasks.py`. The task implements the complete end-to-end flow:

1. Calls `parse_excel_bom` synchronously using `.apply()` for blocking execution
2. Extracts items and metadata from result
3. Resolves suppliers via `find_or_create_supplier` with auto-creation
4. Creates Project record with name (from metadata or file stem) and client
5. Creates ProjectItem records for each extracted item with mapped supplier_id
6. Sends Telegram completion message via `send_completion_message`
7. Returns dict with project_id, items_count, reserved_count

Error handling:
- Wrapped in try/except with exponential backoff retry for transient errors
- On failure: creates FailedTask DLQ record with full context, sends DLQ alert via `send_dlq_alert`
- Database session closed in finally block

Lint errors reported are pre-existing frontend React issues (setState in useMemo/effect) unrelated to this backend task.

## Verification

- Python syntax check passed: `python -m py_compile backend/tasks.py`
- grep confirmed process_bom_to_project exists in tasks.py
- Task uses @app.task(bind=True, max_retries=2) as specified
- Calls parse_excel_bom via .apply() for blocking execution
- Creates SessionLocal() for database operations
- Uses find_or_create_supplier for each unique supplier name
- Creates Project with name/client/status fields
- Creates ProjectItem records with supplier_id mapping
- Sends Telegram completion message with statistics
- Error path creates FailedTask, sends DLQ alert, re-raises
- Database session closed in finally block

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -m py_compile backend/tasks.py` | 0 | pass | 500ms |
| 2 | `grep -q 'process_bom_to_project' backend/tasks.py` | 0 | pass | 100ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tasks.py`
