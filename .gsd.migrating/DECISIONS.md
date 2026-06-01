# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | S03 implementation | architecture | FastAPI router organization | Modular routers per entity with dedicated router files | Keeps code organized as API grows; each entity has its own router file (e.g., projects.py) with standard CRUD endpoints; main.py includes all routers. This pattern scales better than monolithic routers and makes testing easier. | false | agent |
| D002 | M002 planning | architecture | Docker Service Structure for M002 | 4 отдельных Docker сервиса: fastapi, celery-worker, telegram-bot, rabbitmq | Isolation: падение worker'а не останавливает API и Bot. Scaling: можно запустить несколько worker'ов для параллельной обработки. Restart policies: разные настройки для разных типов сервисов. | yes | collaborative |
| D003 | M002 planning | architecture | LLM Error Handling Strategy | Retry 2x с exponential backoff (1s, 5s) → DLQ с сохранением контекста → Telegram alert | Retry handles temporary API failures. DLQ гарантирует что ничего не теряется. Alert даёт владельцу visibility на проблемы. | yes | collaborative |
| D004 | M002 planning | library | Telegram Bot Framework | python-telegram-bot | Зрелая библиотека с хорошей документацией. Поддержка webhook и long polling. Легкая интеграция с RabbitMQ. | yes | agent |
| D005 | M002 planning | architecture | DLQ Persistence Strategy | RabbitMQ DLQ + отдельная таблица в БД для failed tasks с контекстом | RabbitMQ DLQ из коробки для retry logic. БД таблица для персистентности и возможности перезапустить через UI later. Контекст нужен для debugging. | yes | agent |
| D006 | M002 planning | architecture | Excel Parsing Strategy | pandas для чтения + OpenAI GPT-4o для распознавания структуры dirty таблиц | pandas reliably читает Excel. LLM нужна для dirty таблиц (объединенные ячейки, многоэтажные шапки). GPT-4o недорогой и отлично работает со структурированным текстом. | yes | agent |
| D007 | S01-T03 implementation | architecture | Celery worker health check approach | Use app.control.inspect().ping() with 2s timeout | Standard Celery pattern for checking worker availability. Timeout prevents blocking. Returns empty dict when no workers, enabling graceful degradation detection. | yes | agent |
| D008 | S01-T03 implementation | architecture | RabbitMQ health check method | Use app.connection_or_acquire() for broker connectivity | connection_or_acquire() is thread-safe and properly handles connection lifecycle. Returns connection context that auto-closes, preventing resource leaks. | yes | agent |
| D009 | S01-T03 implementation | architecture | Health check failure behavior | Return 503 HTTP status when ANY service is degraded | Fail-fast approach ensures load balancers stop routing to unhealthy instances. Clear distinction between healthy (200) and degraded (503) states. | yes | agent |
| D010 | S02 planning - choosing polling mode for python-telegram-bot | architecture | Telegram Bot Communication Mode | Long polling (run_polling) instead of webhook | Webhook requires HTTPS endpoint and public URL; long polling works in Docker without additional infrastructure. Can migrate to webhook later if needed for scalability. | yes | agent |
