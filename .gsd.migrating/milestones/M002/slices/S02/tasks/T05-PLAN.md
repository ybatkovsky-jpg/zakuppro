---
estimated_steps: 12
estimated_files: 3
skills_used: []
---

# T05: Add stub Celery task and update .env

### Why
Create queue_excel_processing task stub for S03 to implement. Update .env with new bot variables.

### Do
1. Add queue_excel_processing task to backend/tasks.py
2. Task takes file_path and chat_id parameters
3. Stub returns {'status': 'stub', 'file_path': file_path}
4. Update .env with ALLOWED_CHAT_IDS (comma-separated)
5. Ensure /data/uploads volume mount in telegram-bot service

### Done when
- Task is registered in Celery app
- .env has ALLOWED_CHAT_IDS variable
- /data/uploads directory exists

## Inputs

- `backend/tasks.py`
- `.env`
- `docker-compose.yml`

## Expected Output

- `backend/tasks.py`
- `.env`
- `docker-compose.yml`

## Verification

python -c "from backend.tasks import queue_excel_processing; print('task import OK')"

## Observability Impact

Task execution logged
