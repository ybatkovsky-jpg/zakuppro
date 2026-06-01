---
phase: complete
phase_name: Milestone M002 Completion
project: ZakupPro
generated: 2026-06-01T21:40:00Z
counts:
  decisions: 5
  lessons: 8
  patterns: 7
  surprises: 2
missing_artifacts: []
---

# M002 LEARNINGS

## Decisions

### D001: FastAPI Router Organization
- **Decision:** Modular routers per entity with dedicated router files (e.g., projects.py)
- **Choice:** Separate router files for each entity vs monolithic main.py router
- **Rationale:** Keeps code organized as API grows; each entity has its own router file with standard CRUD endpoints; easier testing and better scalability
- **Revisable:** No
- **Source:** .gsd.migrating/DECISIONS.md

### D002: Docker Service Structure for M002
- **Decision:** 4 отдельных Docker сервиса: fastapi, celery-worker, telegram-bot, rabbitmq
- **Choice:** Separate isolated services vs monolithic container
- **Rationale:** Isolation: падение worker'а не останавливает API и Bot. Scaling: можно запустить несколько worker'ов для параллельной обработки. Restart policies: разные настройки для разных типов сервисов.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

### D003: LLM Error Handling Strategy
- **Decision:** Retry 2x с exponential backoff (1s, 5s) → DLQ с сохранением контекста → Telegram alert
- **Choice:** Retry with DLQ fallback vs fail-fast
- **Rationale:** Retry handles temporary API failures. DLQ гарантирует что ничего не теряется. Alert даёт владельцу visibility на проблемы.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

### D004: Telegram Bot Framework
- **Decision:** python-telegram-bot library
- **Choice:** python-telegram-bot vs other bot frameworks
- **Rationale:** Зрелая библиотека с хорошей документацией. Поддержка webhook и long polling. Легкая интеграция с RabbitMQ.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

### D005: DLQ Persistence Strategy
- **Decision:** RabbitMQ DLQ + отдельная таблица в БД для failed tasks с контекстом
- **Choice:** Hybrid approach (RabbitMQ + DB) vs RabbitMQ-only or DB-only
- **Rationale:** RabbitMQ DLQ из коробки для retry logic. БД таблица для персистентности и возможности перезапустить через UI later. Контекст нужен для debugging.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

### D006: Excel Parsing Strategy
- **Decision:** pandas для чтения + OpenAI GPT-4o для распознавания структуры dirty таблиц
- **Choice:** pandas + GPT-4o vs pure LLM or custom parsing
- **Rationale:** pandas reliably читает Excel. LLM нужна для dirty таблиц (объединенные ячейки, многоэтажные шапки). GPT-4o недорогой и отлично работает со структурированным текстом.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

### D011: AI Extraction Output Format
- **Decision:** Structured JSON via OpenAI JSON Schema (strict mode)
- **Choice:** JSON Schema strict mode vs text parsing
- **Rationale:** JSON Schema strict mode guarantees 100% valid output. Eliminates parsing errors and downstream validation complexity. Direct mapping to Pydantic models for type safety.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

### D014: Python-slugify for Email Generation
- **Decision:** Use python-slugify library for safe email local-part generation from Russian company names
- **Choice:** python-slugify vs manual string manipulation
- **Rationale:** Handles Russian transliteration, special characters, and edge cases (e.g., "ООО Вектор" → "ooo-vektor"). Safer than manual string manipulation.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

### D016: Telegram Notifier Error Handling
- **Decision:** Return False instead of raising exceptions when Telegram API calls fail
- **Choice:** Return bool vs raise exception
- **Rationale:** Celery tasks should continue processing even if notifications fail. Failed notifications are non-critical vs data persistence.
- **Revisable:** Yes
- **Source:** .gsd.migrating/DECISIONS.md

## Lessons

### L001: OpenAI SDK APIResponseValidationError
- **What Happened:** OpenAI SDK 1.54+ changed exception type from JSONDecodeError to APIResponseValidationError
- **Root Cause:** SDK refactoring in newer versions
- **Fix:** Updated error handling to catch APIResponseValidationError instead of JSONDecodeError
- **Source:** .gsd.milestones/M002/slices/S03/S03-SUMMARY.md

### L002: Markdown Format Better Than CSV for AI Context
- **What Happened:** Initial tests showed CSV confused GPT-4o's table structure recognition
- **Root Cause:** CSV loses column alignment and visual structure cues
- **Fix:** Convert pandas DataFrame to markdown table format for AI input
- **Source:** .gsd.milestones/M002/slices/S03/S03-SUMMARY.md

### L003: NaN Handling in Pandas to Markdown
- **What Happened:** "NaN" markers appeared in AI prompts, confusing GPT-4o
- **Root Cause:** pandas fillna() not called before markdown conversion
- **Fix:** Use fillna('') to replace NaN with empty strings before markdown conversion
- **Source:** .gsd.milestones/M002/slices/S03/S03-SUMMARY.md

### L004: Exponential Backoff for Rate Limits
- **What Happened:** OpenAI API rate limits caused transient failures
- **Root Cause:** API rate limits on rapid requests
- **Fix:** Implement exponential backoff with countdown=2**retry_count (1s, 2s, 4s) and max_retries=2
- **Source:** .gsd.milestones/M002/slices/S03/S03-SUMMARY.md

### L005: Supplier Resolver Returns None for Empty Names
- **What Happened:** Empty supplier names caused database errors
- **Root Cause:** Missing validation for empty string inputs
- **Fix:** Return None instead of attempting database operation for empty names
- **Source:** .gsd.milestones/M002/slices/S04/S04-SUMMARY.md

### L006: Deferred Imports in Celery Tasks
- **What Happened:** Import errors occurred when task modules loaded at startup
- **Root Cause:** Optional dependencies (telegram) not available in all environments
- **Fix:** Use deferred imports inside try block within Celery task for graceful degradation
- **Source:** .gsd.milestones/M002/slices/S04/S04-SUMMARY.md

### L007: Worker Health Check Timeout
- **What Happened:** Health check could block indefinitely on unresponsive workers
- **Root Cause:** inspect().ping() has no default timeout
- **Fix:** Use 2s timeout for inspect().ping() to prevent blocking
- **Source:** .gsd.milestones/M002/slices/S01/S01-SUMMARY.md

### L008: Duplicate Filename Handling in Telegram
- **What Happened:** Concurrent uploads with same filename could cause collisions
- **Root Cause:** No collision handling in initial implementation
- **Fix:** Append Unix timestamp suffix to duplicate filenames
- **Source:** .gsd.milestones/M002/slices/S02/S02-SUMMARY.md

## Patterns

### P001: Service Healthcheck Pattern
- **Description:** Docker services use healthcheck dependency conditions; each service has explicit healthcheck command
- **Where:** docker-compose.yml service definitions
- **Source:** .gsd.milestones/M002/slices/S01/S01-SUMMARY.md

### P002: DLQ Queue Configuration
- **Description:** Configure DLQ with x-dead-letter-exchange binding and separate queue for failed tasks
- **Where:** backend/celery_app.py
- **Source:** .gsd.milestones/M002/slices/S01/S01-SUMMARY.md

### P003: Celery Task Registration
- **Description:** Register tasks via @app.task decorator with module import; tasks auto-register on worker startup
- **Where:** backend/tasks.py
- **Source:** .gsd.milestones/M002/slices/S01/S01-SUMMARY.md

### P004: Fail-Fast Health Endpoint
- **Description:** Return 503 HTTP status when ANY service is degraded; load balancers stop routing to unhealthy instances
- **Where:** backend/routers/health.py
- **Source:** .gsd.milestones/M002/slices/S01/S01-SUMMARY.md

### P005: Authorization Middleware Pattern
- **Description:** check_access() method called before any handler logic; load allowed IDs from environment
- **Where:** backend/handlers/auth.py
- **Source:** .gsd.milestones/M002/slices/S02/S02-SUMMARY.md

### P006: File Handling Pattern
- **Description:** Validate extension, size, then download, then publish task
- **Where:** backend/handlers/documents.py
- **Source:** .gsd.milestones/M002/slices/S02/S02-SUMMARY.md

### P007: Celery Task with bind=True
- **Description:** Use bind=True for task functions to access self.request for retry logic
- **Where:** backend/tasks.py parse_excel_bom task
- **Source:** .gsd.milestones/M002/slices/S03/S03-SUMMARY.md

### P008: GPT-4o JSON Schema Strict Mode
- **Description:** Use response_format=json_schema for 100% valid JSON output
- **Where:** backend/ai_agent.py extract_bom_structure
- **Source:** .gsd.milestones/M002/slices/S03/S03-SUMMARY.md

### P009: Structured Logging at Pipeline Steps
- **Description:** Log at each step: row counts, markdown char count, AI extraction start/finish
- **Where:** backend/tasks.py parse_excel_bom
- **Source:** .gsd.milestones/M002/slices/S03/S03-SUMMARY.md

### P010: Use python-slugify for Unicode Identifiers
- **Description:** Use python-slugify for safe identifier generation from Unicode input (Russian names)
- **Where:** backend/supplier_resolver.py
- **Source:** .gsd.milestones/M002/slices/S04/S04-SUMMARY.md

### P011: Return None vs Raising Exceptions for Validation
- **Description:** Return None for non-critical validation failures instead of raising exceptions
- **Where:** backend/supplier_resolver.py find_or_create_supplier
- **Source:** .gsd.milestones/M002/slices/S04/S04-SUMMARY.md

### P012: Deferred Imports Inside Task Try Blocks
- **Description:** Import optional dependencies inside try block within Celery task for graceful degradation
- **Where:** backend/tasks.py process_bom_to_project
- **Source:** .gsd.milestones/M002/slices/S04/S04-SUMMARY.md

### P013: Blocking .apply().get() for Chained Tasks
- **Description:** Use .apply().get() for blocking execution of chained tasks within orchestration task
- **Where:** backend/tasks.py process_bom_to_project calling parse_excel_bom
- **Source:** .gsd.milestones/M002/slices/S04/S04-SUMMARY.md

## Surprises

### S001: Long Polling Sufficient for Telegram Bot
- **Discovery:** Webhook not required initially; long polling works in Docker without additional infrastructure
- **Impact:** Simplified deployment; webhook can be added later for scalability
- **Source:** .gsd.migrating/DECISIONS.md (D010)

### S002: 20MB File Limit Adequate for BOM Files
- **Discovery:** Initial assumption that BOM files might be larger was incorrect
- **Impact:** 20MB limit prevents abuse while accommodating substantial real-world BOM files
- **Source:** .gsd.milestones/M002/slices/S02/S02-SUMMARY.md
