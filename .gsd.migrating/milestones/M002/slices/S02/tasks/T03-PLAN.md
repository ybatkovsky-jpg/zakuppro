---
estimated_steps: 14
estimated_files: 1
skills_used: []
---

# T03: Implement document handler for Excel upload with task publishing

### Why
Core feature: accept Excel files, save locally, publish to RabbitMQ for async processing per R001, R002.

### Do
1. Create backend/handlers/documents.py
2. Implement handle_document async handler
3. Check auth via AuthMiddleware
4. Download file to /data/uploads/{file_name}
5. Call tasks.queue_excel_processing.delay(file_path, chat_id)
6. Reply to user with task_id and processing status
7. Add filters.Document.Extension('xlsx') filter

### Done when
- Document handler downloads files to /data/uploads
- Tasks are published to Celery (queue_excel_processing)
- User receives confirmation with task_id

## Inputs

- `backend/handlers/auth.py`
- `backend/celery_app.py`

## Expected Output

- `backend/handlers/documents.py`

## Verification

python -c "from backend.handlers.documents import handle_document; print('document handler import OK')"

## Observability Impact

File uploads logged with file_name, chat_id, task_id
