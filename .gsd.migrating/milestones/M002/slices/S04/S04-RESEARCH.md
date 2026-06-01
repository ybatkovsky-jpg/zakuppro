# S04: Project Creation + DLQ — Research

**Research Lane:** Targeted research for end-to-end flow integration with existing API patterns and DLQ infrastructure already in place.

## Summary

S04 completes the M002 end-to-end flow: **Excel from Telegram → BOM parsing → Project/ProjectItem creation in DB → Telegram response with statistics**. The slice also implements DLQ persistence with Telegram alerts.

**Key Finding:** Most infrastructure already exists from S01-S03. S04 primarily integrates:
1. Chain `queue_excel_processing` → `parse_excel_bom` tasks
2. Create Project + ProjectItem via existing FastAPI endpoints
3. Add FailedTask model + DLQ logging
4. Implement Telegram notification callback on completion
5. Handle supplier resolution (create-or-find by name)

## Dependency Analysis

### Upstream Consumption (from S02, S03)

| Artifact | Provides | Consumed By |
|----------|----------|-------------|
| `backend/tasks.py:queue_excel_processing` | File validation, task_id return | Must call `parse_excel_bom.delay()` |
| `backend/tasks.py:parse_excel_bom` | Returns `{items, metadata}` | Must convert to Project/ProjectItem |
| `backend/handlers/documents.py` | chat_id, file_path | Callback notification target |
| `celery_app.py` | DLQ queue, retry logic | FailedTask logging destination |
| `ai_agent.py:ExtractedBOM` | `items: list[BOMItem]`, `metadata: BOMMetadata` | Source for Project fields |

### Downstream Production (for S04)

S04 produces:
- Complete end-to-end BOM upload flow
- FailedTask DLQ model with context preservation
- Telegram alert mechanism for DLQ events
- Supplier auto-creation from extracted names

## Existing API Patterns

### Project Creation (from `backend/routers/projects.py`)

```python
# Existing endpoint: POST /api/projects
# Input: ProjectCreate(name, client, status, total_cost)
# Output: ProjectResponse with id

@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project_data: ProjectCreate, db: Session = Depends(get_db)):
    new_project = Project(**project_data.model_dump())
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project
```

**Pattern:** Direct `model_dump()` to ORM model, commit, refresh.

### ProjectItem Creation (from `backend/routers/project_items.py`)

```python
# Existing endpoint: POST /api/project-items
# Input: ProjectItemCreate(name, sku, qty, status, supplier_id, stock_item_id, project_id)
# Output: ProjectItemResponse

@router.post("/", response_model=ProjectItemResponse, status_code=201)
def create_project_item(item_data: ProjectItemCreate, db: Session = Depends(get_db)):
    new_item = ProjectItem(**item_data.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item
```

**Key constraint:** `project_id` required, `supplier_id` optional.

### Database Session Pattern (from `backend/database.py`)

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Usage in tasks:** Must create session manually with `SessionLocal()` and explicitly close.

## AI Output Format (from `backend/ai_agent.py`)

```python
class BOMItem(BaseModel):
    sku: str
    name: str
    qty: int
    supplier: Optional[str]  # Supplier name, not ID

class BOMMetadata(BaseModel):
    project_name: Optional[str]
    client: Optional[str]

class ExtractedBOM(BaseModel):
    items: list[BOMItem]
    metadata: Optional[BOMMetadata]
```

**Critical gap:** AI returns `supplier: str` (name), but `ProjectItem` requires `supplier_id: int`. Resolution needed: create-or-find Supplier by name.

## DLQ Infrastructure (from `celery_app.py`)

Already configured:
```python
# RabbitMQ DLQ with x-dead-letter-exchange routing
dlq_exchange = Exchange('dlq', type='direct', durable=True)
dlq_queue = Queue('dlq', exchange=dlq_exchange, routing_key='dlq', durable=True)

# Tasks failing after max_retries automatically route to DLQ
default_queue = Queue(
    'default',
    queue_arguments={
        'x-dead-letter-exchange': 'dlq',
        'x-dead-letter-routing-key': 'dlq',
    }
)
```

**Missing:** Database table for DLQ context persistence (Required by R005).

## Telegram Notification Requirements

Environment variables available:
- `TELEGRAM_BOT_TOKEN` — Bot authentication
- `TELEGRAM_OWNER_CHAT_ID` — Destination for alerts
- `ALLOWED_CHAT_IDS` — Authorization list

**Existing pattern:** `update.effective_message.reply_text()` in `handlers/documents.py`

**Gap:** No callback mechanism from Celery task → Telegram Bot. Need:
- Direct telegram.Bot instance in tasks
- Send message to `chat_id` on completion
- Send alert to `TELEGRAM_OWNER_CHAT_ID` on DLQ

## Implementation Landscape

### 1. Task Chaining Modification

**File:** `backend/tasks.py`

**Current:**
```python
@app.task(name='tasks.queue_excel_processing', bind=True)
def queue_excel_processing(self, file_path: str, chat_id: int) -> dict:
    # Only validates file, returns status
```

**Required:**
```python
@app.task(name='tasks.queue_excel_processing', bind=True)
def queue_excel_processing(self, file_path: str, chat_id: int) -> dict:
    # Call parse_excel_bom.delay(file_path, chat_id)
    # Return task_id for chaining
```

### 2. Main Orchestration Task

**New task:** `process_bom_to_project(file_path, chat_id)`

**Flow:**
1. Call `parse_excel_bom(file_path, chat_id)` via `.apply()`
2. Extract `items`, `metadata` from result
3. Create `Supplier` records (find-or-create by name)
4. Create `Project` from `metadata.project_name`, `metadata.client`
5. Create `ProjectItem` records with supplier_id mapping
6. Send Telegram success message with statistics
7. Return `project_id`, `items_count`, `reserved_count`

**Error handling:** Wrap steps 3-5 in try/except → log to FailedTask → send Telegram alert

### 3. FailedTask Model

**File:** `backend/models.py` (new model)

```python
class FailedTask(Base):
    """DLQ persistence for failed Celery tasks."""
    __tablename__ = "failed_tasks"
    
    id = Column(Integer, primary_key=True)
    task_id = Column(String(255), nullable=False, unique=True)
    task_name = Column(String(100), nullable=False)
    error_message = Column(Text, nullable=False)
    error_type = Column(String(100), nullable=False)
    file_path = Column(String(500), nullable=True)
    chat_id = Column(Integer, nullable=True)
    context = Column(Text, nullable=True)  # JSON: prompt, LLM response, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Migration required:** Add Alembic revision for `failed_tasks` table.

### 4. Supplier Resolution Module

**File:** `backend/supplier_resolver.py` (new)

```python
def find_or_create_supplier(db: Session, name: str) -> Optional[int]:
    """Find existing supplier by name or create new one."""
    supplier = db.query(Supplier).filter(Supplier.name == name).first()
    if supplier:
        return supplier.id
    # Create with default email placeholder
    new_supplier = Supplier(name=name, email=f"auto-{slugify(name)}@placeholder.com")
    db.add(new_supplier)
    db.commit()
    return new_supplier.id
```

**Trade-off:** Email required field, use placeholder format for auto-created suppliers. User updates later via UI.

### 5. Telegram Notification Helper

**File:** `backend/telegram_notifier.py` (new)

```python
from telegram import Bot
import os

def send_completion_message(chat_id: int, project_name: str, items_count: int, reserved_count: int):
    """Send success message after Project creation."""
    bot = Bot(token=os.getenv("TELEGRAM_BOT_TOKEN"))
    bot.send_message(
        chat_id=chat_id,
        text=f"✅ Проект '{project_name}' создан\\n\\n📊 Позиций: {items_count}\\n📦 Зарезервировано: {reserved_count}"
    )

def send_dlq_alert(task_id: str, error_message: str, file_path: str):
    """Send alert to owner when task fails to DLQ."""
    owner_id = int(os.getenv("TELEGRAM_OWNER_CHAT_ID"))
    bot = Bot(token=os.getenv("TELEGRAM_BOT_TOKEN"))
    bot.send_message(
        chat_id=owner_id,
        text=f"⚠️ Задача #{task_id} упала в DLQ\\n\\n📁 Файл: {file_path}\\n❌ Ошибка: {error_message}"
    )
```

**Environment:** TELEGRAM_BOT_TOKEN already configured.

### 6. DLQ Event Handler

**File:** `backend/tasks.py` (new function)

```python
@app.task(bind=True, name='tasks.handle_dlq_event')
def handle_dlq_event(self, task_id: str, error_message: str, file_path: str, chat_id: int):
    """Handle DLQ events - persist to DB and alert."""
    db = SessionLocal()
    try:
        failed_task = FailedTask(
            task_id=task_id,
            task_name='parse_excel_bom',
            error_message=error_message,
            error_type='ValueError',
            file_path=file_path,
            chat_id=chat_id,
            context=json.dumps({'file_path': file_path, 'chat_id': chat_id})
        )
        db.add(failed_task)
        db.commit()
        
        # Send Telegram alert
        send_dlq_alert(task_id, error_message, file_path)
    finally:
        db.close()
```

**Trigger:** Celery `task_failure` signal or explicit call from `parse_excel_bom` except block.

## Don't Hand-Roll

### Existing Python Libraries

- `python-telegram-bot` — Already in use, has `Bot.send_message()` for notifications
- `sqlalchemy.orm.Session` — Use `SessionLocal()` for task database access
- `celery.chain` — Use for task chaining instead of manual callback
- `slugify` (python-slugify) — For supplier email placeholder generation

## Open Questions (Resolved)

### Q1: How to chain queue_excel_processing → parse_excel_bom?
**Answer:** Modify `queue_excel_processing` to call `parse_excel_bom.apply_async()` and return the AsyncResult. Or rename task to `process_bom_upload` that orchestrates full flow.

### Q2: Where to store DLQ context?
**Answer:** New `FailedTask` model in PostgreSQL. RabbitMQ DLQ handles retry; DB table preserves context for debugging and manual reprocessing.

### Q3: How to send Telegram message from Celery task?
**Answer:** Create `Bot` instance with `TELEGRAM_BOT_TOKEN`, call `send_message()`. No webhook needed for outbound messages.

### Q4: Supplier email required?
**Answer:** Yes, per `Supplier` model. Use placeholder format `auto-{slugified-name}@placeholder.com` for auto-created suppliers. User updates via UI.

### Q5: Task chain vs. single orchestrator task?
**Answer:** Single orchestrator task `process_bom_to_project` is simpler. `parse_excel_bom` remains reusable for testing and other flows.

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supplier name collision | Duplicate suppliers | Query by exact name first; create only if not found |
| Database session leak in tasks | Connection pool exhaustion | Explicit `db.close()` in `finally` block |
| Telegram rate limit | Alert blocked | Batch alerts, handle `TelegramApiError` |
| AI returns null metadata | Project name missing | Fallback to file stem or "Unnamed Project" |
| DLQ event not captured | Task lost without trace | Use Celery `task_failure` signal + DB transaction |

## Files and Purpose

| File | Purpose | Change |
|------|---------|--------|
| `backend/models.py` | ORM models | Add `FailedTask` class |
| `backend/tasks.py` | Celery task definitions | Add `process_bom_to_project` task, modify `queue_excel_processing`, add `handle_dlq_event` |
| `backend/supplier_resolver.py` | New module | Find-or-create supplier logic |
| `backend/telegram_notifier.py` | New module | Telegram notification helpers |
| `backend/alembic/versions/xxx_add_failed_tasks.py` | New migration | Create `failed_tasks` table |
| `backend/routers/projects.py` | No change | Use existing endpoint via direct import |
| `backend/routers/project_items.py` | No change | Use existing model, not endpoint |
| `backend/ai_agent.py` | No change | Consumed as-is |
| `backend/excel_parser.py` | No change | Consumed as-is |
| `backend/celery_app.py` | No change | DLQ already configured |

## Natural Seams

1. **Supplier resolution** — Independent module, testable separately
2. **Telegram notifications** — Separate helper, mockable for tests
3. **DLQ persistence** — Separate model + migration
4. **Orchestration task** — Integrates above components

## First Proof

**Highest risk:** Database session management in Celery task + Telegram notification integration.

**Verification:**
1. Create simple task that opens `SessionLocal()`, queries `Project`, closes session
2. Create `telegram_notifier.py` with `send_message()` test
3. Run via `celery -A backend.celery_app call tasks.dummy_db_test`

## Verification Commands

```bash
# Test FailedTask migration
alembic upgrade head

# Test supplier resolution
python -c "from backend.supplier_resolver import find_or_create_supplier; from backend.database import SessionLocal; db = SessionLocal(); print(find_or_create_supplier(db, 'Test Supplier')); db.close()"

# Test Telegram notification (requires valid token)
python -c "from backend.telegram_notifier import send_completion_message; send_completion_message(123456, 'Test', 10, 5)"

# Test full flow
docker-compose exec celery-worker celery -A backend.celery_app call tasks.process_bom_to_project '["/data/uploads/test.xlsx", 123456]'

# Verify DLQ entries
psql -h localhost -U postgres -d zakuppro -c "SELECT * FROM failed_tasks;"
```

## Constraints

1. **Pydantic v2** — Use `model_config = ConfigDict(from_attributes=True)` pattern (see `schemas.py`)
2. **SQLAlchemy 2.0** — Use `relationship(back_populates=...)` not `backref` (see `models.py`)
3. **Timezone** — All DateTime columns use `timezone=True` (see existing models)
4. **Foreign keys** — ProjectItem requires valid `project_id`, `supplier_id` nullable
5. **Telegram Bot token** — Must be valid for outbound messages (test environment)
6. **OpenAI API key** — Already used by S03, no new requirements

## Sources

- python-telegram-bot docs: https://docs.python-telegram-bot.org/
- Celery task signals: https://docs.celeryq.io/en/stable/userguide/signals.html
- SQLAlchemy sessions: https://docs.sqlalchemy.org/en/20/orm/session_basics.html
