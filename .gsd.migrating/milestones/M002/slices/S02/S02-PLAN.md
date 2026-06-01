# S02: Telegram Bot Gateway

**Goal:** Implement Telegram Bot service that accepts Excel files from authorized chat_ids, saves files locally, and publishes processing tasks to RabbitMQ
**Demo:** Telegram Bot принимает Excel файл от разрешённого chat_id, сохраняет локально, публикует задачу в RabbitMQ

## Must-Haves

- Telegram bot service runs in Docker and responds to /start command
- File uploads from authorized chat_id are accepted and saved
- Task is published to RabbitMQ queue for processing
- Unauthorized access is rejected with warning logged

## Proof Level

- This slice proves: Automated test with docker-compose up and manual Telegram interaction

## Integration Closure

S02 consumes RabbitMQ from S01 for task publishing. Creates stub queue_excel_processing task for S03 to implement. S04 will complete end-to-end flow.

## Verification

- Bot startup/shutdown logging
- File upload events with chat_id and file_name
- Task publication with task_id
- Authorization failures logged with chat_id

## Tasks

- [x] **T01: Add telegram-bot service to docker-compose.yml** `est:15m`
  ### Why
  Telegram Bot needs to run as isolated Docker service per D002. Should depend on RabbitMQ healthcheck.
  - Files: `docker-compose.yml`
  - Verify: grep -q telegram-bot docker-compose.yml

- [x] **T02: Create backend/handlers package with auth middleware** `est:30m`
  ### Why
  Authorization middleware ensures only allowed chat_ids can use the bot per R001. handlers package organizes bot logic.
  - Files: `backend/handlers/__init__.py`, `backend/handlers/auth.py`, `backend/handlers/commands.py`
  - Verify: python -c "from backend.handlers.auth import AuthMiddleware; from backend.handlers.commands import start_command; print('handlers import OK')"

- [x] **T03: Implement document handler for Excel upload with task publishing** `est:45m`
  ### Why
  Core feature: accept Excel files, save locally, publish to RabbitMQ for async processing per R001, R002.
  - Files: `backend/handlers/documents.py`
  - Verify: python -c "from backend.handlers.documents import handle_document; print('document handler import OK')"

- [x] **T04: Create telegram_bot.py main application entry point** `est:30m`
  ### Why
  Entry point for running the bot service. Builds Application, registers handlers, starts polling.
  - Files: `backend/telegram_bot.py`
  - Verify: python -c "import backend.telegram_bot; print('telegram_bot module OK')"

- [x] **T05: Add stub Celery task and update .env** `est:15m`
  ### Why
  Create queue_excel_processing task stub for S03 to implement. Update .env with new bot variables.
  - Files: `backend/tasks.py`, `.env`, `docker-compose.yml`
  - Verify: python -c "from backend.tasks import queue_excel_processing; print('task import OK')"

## Files Likely Touched

- docker-compose.yml
- backend/handlers/__init__.py
- backend/handlers/auth.py
- backend/handlers/commands.py
- backend/handlers/documents.py
- backend/telegram_bot.py
- backend/tasks.py
- .env
