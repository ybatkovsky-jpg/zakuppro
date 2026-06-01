# Research: Telegram Bot Gateway (Slice S02)

## Executive Summary

This research covers the implementation of a Telegram Bot for ZakupPro using the `python-telegram-bot` library (v21.10). The bot will serve as a gateway for Excel file uploads, chat_id-based authorization, and status notifications. The implementation aligns with existing project decisions (D002, D003, D004) and integrates with the existing Celery/RabbitMQ infrastructure.

## 1. Existing Codebase Analysis

### 1.1 Docker Infrastructure (`D:\CLAUDE\Project\zakuppro\zakuppro\docker-compose.yml`)

Current services:
- **db**: PostgreSQL 15-alpine on port 5432
- **api**: FastAPI application on port 8000
- **rabbitmq**: RabbitMQ 3-management on ports 5672 (AMQP) and 15672 (Management UI)
- **celery-worker**: Celery worker with command `celery -A backend.celery_app worker --loglevel=info`

**Missing**: `telegram-bot` service (to be added per D002)

The RabbitMQ service is already configured with health checks and management UI, which will be useful for monitoring DLQ (Dead Letter Queue) for failed tasks.

### 1.2 Environment Variables (`.env`)

Existing Telegram variables:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_OWNER_CHAT_ID=your_chat_id_here
```

**Missing**: `ALLOWED_CHAT_IDS` for authorization middleware (comma-separated list of authorized chat IDs)

### 1.3 Backend Dependencies (`backend/requirements.txt`)

- `python-telegram-bot==21.10` - Already included, fully async, requires Python 3.9+
- `celery[rabbitmq]` - Already included for task processing
- `redis` - Already included for Celery result backend
- `pandas`, `openpyxl` - For Excel file parsing (per D006)

### 1.4 Celery Configuration (`backend/celery_app.py`)

The Celery app is configured with:
- **Broker**: RabbitMQ (`pyamqp://guest:guest@rabbitmq:5672//`)
- **Result Backend**: Redis (`redis://redis:6379/0`)
- **DLQ Setup**:
  ```python
  dlq_exchange = Exchange('dlq', type='direct', durable=True)
  dlq_queue = Queue('dlq', exchange=dlq_exchange, routing_key='dlq', durable=True)
  default_queue = Queue('default', queue_arguments={
      'x-dead-letter-exchange': 'dlq',
      'x-dead-letter-routing-key': 'dlq',
      'x-message-ttl': 86400000,  # 24 hours
  })
  ```
- **Task Time Limits**: 30 min hard, 25 min soft
- **Task Result Expiration**: 24 hours

This configuration aligns with D003 (retry → DLQ → alert pattern).

### 1.5 Existing Tasks (`backend/tasks.py`)

Example tasks demonstrate the pattern:
```python
@app.task(name='tasks.dummy_health_check', bind=True)
def dummy_health_check(self):
    logger.info(f"Health check task {self.request.id} executing")
    return {'status': 'ok', 'message': 'Celery worker is alive', 'task_id': self.request.id}
```

## 2. python-telegram-bot v21.10 Patterns

### 2.1 Application Setup (Fully Async)

```python
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters
import asyncio

async def main() -> None:
    application = Application.builder().token("YOUR_TOKEN").build()
    
    # Add handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    
    # Run the bot
    await application.initialize()
    await application.start()
    await application.updater.start_polling()
    
    # Keep running
    await asyncio.Event().wait()
```

### 2.2 File/Document Handling

```python
from telegram import Update
from telegram.ext import ContextTypes
import pandas as pd

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle Excel file uploads from Telegram."""
    document = update.message.document
    
    # Download file to temporary location
    file = await document.get_file()
    temp_path = f"/tmp/{document.file_name}"
    await file.download_to_drive(temp_path)
    
    # Parse Excel with pandas
    df = pd.read_excel(temp_path, engine='openpyxl')
    
    # Publish parsing task to Celery
    from backend.tasks import parse_excel_task
    task = parse_excel_task.delay(temp_path, update.effective_chat.id)
    
    await update.message.reply_text(f"File received. Task ID: {task.id}")
```

**Key Filters for Documents**:
- `filters.Document.ALL` - All documents
- `filters.Document.MimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")` - Excel specifically
- `filters.Document.Extension("xlsx")` - By extension

### 2.3 Chat ID Authorization

**Method 1: Filter-based Authorization**
```python
from telegram.ext import filters

# Create filter for allowed chat IDs
ALLOWED_CHAT_IDS = [123456789, 987654321]  # From env var

def is_allowed_chat(update: Update):
    return update.effective_chat.id in ALLOWED_CHAT_IDS

allowed_filter = filters.Create(is_allowed_chat)

# Apply to handlers
application.add_handler(
    MessageHandler(allowed_filter & filters.Document.ALL, handle_document)
)
```

**Method 2: Handler-level Authorization**
```python
async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    ALLOWED_CHAT_IDS = [int(x) for x in os.getenv("ALLOWED_CHAT_IDS", "").split(",")]
    
    if update.effective_chat.id not in ALLOWED_CHAT_IDS:
        await update.message.reply_text("Unauthorized. Your chat ID has been logged.")
        logger.warning(f"Unauthorized access attempt from chat_id: {update.effective_chat.id}")
        return
```

**Method 3: Custom Middleware (Recommended)**
```python
from telegram import Update
from telegram.ext import ContextTypes

class AuthMiddleware:
    def __init__(self, allowed_chat_ids):
        self.allowed_chat_ids = set(allowed_chat_ids)
    
    async def check_access(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> bool:
        chat_id = update.effective_chat.id
        
        if chat_id not in self.allowed_chat_ids:
            await update.message.reply_text("⛔ Access denied. Unauthorized chat ID.")
            logger.warning(f"Unauthorized access from chat_id={chat_id}")
            return False
        
        return True

# Usage in handlers
auth = AuthMiddleware(ALLOWED_CHAT_IDS)

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await auth.check_access(update, context):
        return
    # ... rest of handler
```

### 2.4 Message Handlers Pattern

```python
from telegram.ext import CommandHandler, MessageHandler, ConversationHandler, filters

# Command handlers (e.g., /start, /help, /status)
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Welcome to ZakupPro Bot!\n"
        "Upload an Excel file with BOM data to create a new project."
    )

# Status command - shows project status from DB
async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Fetch user's projects from DB
    from backend.database import get_user_projects
    projects = await get_user_projects(update.effective_chat.id)
    
    message = "Your projects:\n" + "\n".join(f"- {p.name}: {p.status}" for p in projects)
    await update.message.reply_text(message)

# Conversation handler for multi-step flows
async def project_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['project_name'] = update.message.text
    await update.message.reply_text("Great! Now upload the Excel file.")
    return UPLOAD_FILE

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Operation cancelled.")
    return ConversationHandler.END

conversation_handler = ConversationHandler(
    entry_points=[CommandHandler("new", project_name)],
    states={
        UPLOAD_FILE: [MessageHandler(filters.Document.ALL, handle_document)],
    },
    fallbacks=[CommandHandler("cancel", cancel)],
)
```

### 2.5 Error Handling (D003 Pattern)

```python
import logging
from celery import Celery
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)

async def handle_error(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Global error handler."""
    logger.error(f"Update {update} caused error {context.error}")
    
    # Notify user
    if update and update.effective_message:
        await update.effective_message.reply_text(
            "⚠️ An error occurred. The administrator has been notified."
        )
    
    # Send alert to owner (per D003)
    OWNER_CHAT_ID = int(os.getenv("TELEGRAM_OWNER_CHAT_ID"))
    await context.bot.send_message(
        chat_id=OWNER_CHAT_ID,
        f"❌ Bot error: {context.error}"
    )

# Register error handler
application.add_error_handler(handle_error)
```

### 2.6 Callback Context Pattern

```python
# Access to bot data (shared across handlers)
async def some_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Bot data (persistent across restarts if using pickle persistence)
    context.bot_data['some_key'] = 'value'
    
    # User data (per-user, non-persistent by default)
    context.user_data['user_key'] = 'value'
    
    # Chat data (per-chat)
    context.chat_data['chat_key'] = 'value'
```

## 3. RabbitMQ Integration Points

### 3.1 Publishing Tasks from Telegram Bot

The Telegram bot can publish tasks to Celery workers using the existing Celery app:

```python
from backend.celery_app import app

# In backend/tasks.py (to be created)
@app.task(name='tasks.parse_excel_file')
def parse_excel_task(file_path: str, chat_id: int):
    """Parse Excel file and create project in database."""
    import pandas as pd
    from backend.database import create_project
    
    df = pd.read_excel(file_path, engine='openpyxl')
    
    # Parse and create project
    project = create_project_from_df(df, chat_id)
    
    return {'project_id': project.id, 'status': 'created'}
```

### 3.2 Task Publishing from Telegram Handler

```python
async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    document = update.message.document
    file = await document.get_file()
    temp_path = f"/tmp/{document.file_name}"
    await file.download_to_drive(temp_path)
    
    # Publish to Celery
    from backend.tasks import parse_excel_task
    result = parse_excel_task.delay(temp_path, update.effective_chat.id)
    
    await update.message.reply_text(
        f"✅ File received!\n"
        f"Processing task: {result.id}\n"
        f"You'll receive a notification when processing completes."
    )
```

### 3.3 DLQ Monitoring

Failed tasks automatically route to DLQ per Celery configuration. The bot can implement:

```python
async def dlq_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check DLQ status (admin only)."""
    # This requires implementing a DLQ inspection mechanism
    # Could use Celery's inspect API or RabbitMQ management API
    pass
```

## 4. Docker Service Configuration

### 4.1 Recommended `telegram-bot` Service

```yaml
# Add to docker-compose.yml
telegram-bot:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: zakuppro-telegram-bot
  command: python -m backend.telegram_bot  # New module to create
  environment:
    TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
    TELEGRAM_OWNER_CHAT_ID: ${TELEGRAM_OWNER_CHAT_ID}
    ALLOWED_CHAT_IDS: ${ALLOWED_CHAT_IDS}
    CELERY_BROKER_URL: pyamqp://guest:guest@rabbitmq:5672//
  depends_on:
    rabbitmq:
      condition: service_healthy
  restart: unless-stopped
  networks:
    - zakuppro-network
```

### 4.2 Environment Variables Update

Add to `.env`:
```
# Telegram Bot Authorization (comma-separated list of allowed chat IDs)
ALLOWED_CHAT_IDS=123456789,987654321
```

## 5. Implementation Recommendations

### 5.1 File Structure

```
backend/
├── telegram_bot.py       # Main bot application entry point
├── handlers/             # Bot handler modules
│   ├── __init__.py
│   ├── auth.py          # Authorization middleware
│   ├── documents.py     # File upload handlers
│   ├── commands.py      # Command handlers (/start, /status, /help)
│   └── conversations.py # ConversationHandler definitions
├── middleware/           # Custom middleware
│   └── auth.py
└── tasks/
    └── telegram_tasks.py # Telegram-specific Celery tasks
```

### 5.2 Key Implementation Points

1. **Authorization**: Implement `ALLOWED_CHAT_IDS` filter on ALL handlers
2. **File Handling**: Download to `/tmp`, parse with pandas, publish to Celery
3. **Error Handling**: Retry 2x (Celery) → DLQ → Telegram alert to owner (per D003)
4. **State Management**: Use ConversationHandler for multi-step flows
5. **Notifications**: Send status updates on task completion (Celery → Telegram)
6. **Docker Isolation**: Separate service per D002 with `restart: unless-stopped`

### 5.3 Integration with Existing System

- **Celery**: Reuse existing `backend.celery_app` for task publishing
- **Database**: Create new tasks for DB operations (project creation, status updates)
- **DLQ**: Already configured; monitor via RabbitMQ Management UI on port 15672
- **Logging**: Use existing logging configuration; add Telegram-specific handlers

## 6. Open Questions

1. **Webhook vs Long Polling**: Webhook requires HTTPS endpoint; long polling simpler for Docker setup. Recommend starting with long polling.
2. **File Persistence**: Downloaded Excel files should be cleaned up after processing.
3. **Task Notifications**: Need mechanism for Celery tasks to send Telegram notifications on completion.

## 7. References

- python-telegram-bot Documentation: https://python-telegram-bot.readthedocs.io/
- Celery Documentation: https://docs.celeryproject.org/
- RabbitMQ DLQ Pattern: https://www.rabbitmq.com/dlx.html
- Project Decisions: See `DECISIONS.md` (D002, D003, D004, D005, D006)