---
estimated_steps: 20
estimated_files: 2
skills_used: []
---

# T01: Create FailedTask Model and Database Migration

## Why
DLQ context persistence (R005) requires a database table to store failed task details including task_id, error message, file_path, chat_id, and JSON context for debugging and manual reprocessing.

## Do
1. Add `FailedTask` model class to `backend/models.py` with columns:
   - id (Integer, primary key)
   - task_id (String(255), unique=True)
   - task_name (String(100))
   - error_message (Text)
   - error_type (String(100))
   - file_path (String(500), nullable)
   - chat_id (Integer, nullable)
   - context (Text, nullable for JSON)
   - created_at (DateTime(timezone=True), server_default=func.now())
2. Follow SQLAlchemy 2.0 patterns: no backref, use timezone=True for DateTime
3. Generate Alembic migration: `alembic revision --autogenerate -m "add_failed_tasks_table"`
4. Apply migration: verify with `alembic current` shows latest revision

## Done when
- FailedTask model defined in models.py
- Migration file generated and applied
- Table exists in PostgreSQL with correct schema

## Inputs

- `backend/models.py`
- `backend/database.py`

## Expected Output

- `backend/models.py`
- `backend/alembic/versions/*.py`

## Verification

python -c "from backend.models import FailedTask; print('FailedTask imported successfully')"
