# M002: Asynchronous Core + AI-Agent Foundation

**Gathered:** 2026-06-01
**Status:** Ready for planning

## Project Description

M002 создаёт асинхронное ядро системы с message broker и AI-агентом для автоматической обработки спецификаций (BOM) из Excel файлов, загружаемых через Telegram Bot.

## Why This Milestone

M001 создал фундамент (БД + CRUD API), но система остаётся синхронной и ручной. M002 добавляет критичную автоматизацию:
- Владелец может загрузить BOM через Telegram без использования UI
- Тяжёлые операции (LLM, парсинг Excel) выполняются асинхронно
- Ничто не теряется благодаря DLQ и retry

Это первый "живой" flow из SPEC.md, демонстрирующий end-to-end автоматизацию.

## User-Visible Outcome

### When this milestone is complete, the user can:

1. Отправить Excel файл с спецификацией в Telegram Bot
2. Получить подтверждение приёма файла
3. Получить уведомление когда Project создан с статистикой (количество позиций, сколько зарезервировано со склада)
4. Получить alert если задача упала в DLQ

### Entry point / environment

- Entry point: Telegram Bot (сообщение с Excel файлом)
- Environment: local dev (Docker Compose: fastapi, celery-worker, telegram-bot, rabbitmq, postgres)
- Live dependencies involved: Telegram Bot API, OpenAI API (GPT-4o), RabbitMQ, PostgreSQL

## Completion Class

- Contract complete means: Все сервисы стартуют в Docker, задачи кладутся в RabbitMQ, Celery worker обрабатывает, DLQ работает
- Integration complete means: Владелец может кинуть Excel в Telegram → Telegram Bot сохраняет файл → Celery worker парсит через LLM → Project создается в БД → ответ отправляется в Telegram
- Operational complete means: Worker падает при обработке — задача рестартует или уходит в DLQ, владелец получает alert

## Final Integrated Acceptance

To call this milestone complete, we must prove:

1. **Full Flow 1 (partial):** Excel из Telegram → parsing → Project + ProjectItem в БД → ответ в Telegram с реальной таблицей из production-like PostgreSQL
2. **DLQ scenario:** LLM возвращает невалидный JSON → retry 2x → задача в DLQ → Telegram alert владельцу
3. **Dirty Excel:** Объединенные ячейки и многоэтажные шапки распознаются корректно
4. **Service isolation:** Остановка celery-worker не останавливает telegram-bot и fastapi

## Architectural Decisions

### Docker Service Structure

**Decision:** 4 отдельных Docker сервиса: fastapi, celery-worker, telegram-bot, rabbitmq

**Rationale:**
- **Isolation:** падение worker'а не останавливает API и Bot
- **Scaling:** можно запустить несколько worker'ов для параллельной обработки
- **Restart policies:** разные настройки для разных типов сервисов

**Alternatives Considered:**
- Объединить telegram-bot + celery-worker — проще, но теряем isolation
- Всё в одном сервисе — невозможно масштабировать worker'ов

### LLM Error Handling Strategy

**Decision:** Retry 2x с exponential backoff (1s, 5s) → DLQ с сохранением контекста → Telegram alert

**Rationale:**
- Retry handles temporary API failures
- DLQ гарантирует что ничего не теряется
- Alert даёт владельцу visibility на проблемы

**Alternatives Considered:**
- Только retry без DLQ — задачи теряются при permanent failures
- Сразу в DLQ без retry — temporary сбои убивают задачи

### Telegram Bot Framework

**Decision:** python-telegram-bot с webhook или polling (определяется в реализации)

**Rationale:**
- Зрелая библиотека с хорошей документацией
- Поддержка как webhook, так и long polling
- Легкая интеграция с RabbitMQ (просто публикует задачу)

**Alternatives Considered:**
- aiogram — более асинхронный, но более сложный API
- Telepy — менее зрелый

### DLQ Persistence

**Decision:** RabbitMQ DLQ + отдельная таблица в БД для failed tasks с контекстом

**Rationale:**
- RabbitMQ DLQ из коробки для retry logic
- БД таблица для персистентности и возможности перезапустить через UI (later)
- Контекст (промпт, ответ LLM, Excel path) нужен для debugging

**Alternatives Considered:**
- Только RabbitMQ DLQ — теряем контекст при перезапуске
- Только БД таблица — сложнее реализовать retry logic

### Excel Parsing Strategy

**Decision:** pandas для чтения + OpenAI GPT-4o для распознавания структуры dirty таблиц

**Rationale:**
- pandas reliably читает Excel в CSV/JSON
- LLM нужна для "грязных" таблиц (объединенные ячейки, многоэтажные шапки)
- GPT-4o недорогой и отлично работает со структурированным текстом

**Alternatives Considered:**
- Только pandas без LLM — не справится с dirty форматами
- Только LLM без pandas — дорого и медленно для больших файлов

## Error Handling Strategy

### Component Failures

| Component | Failure Mode | Handling |
|-----------|---------------|----------|
| RabbitMQ | Down | Telegram Bot возвращает ошибку "Сервис временно недоступен" |
| OpenAI API | Timeout/429/5xx | Retry 2x с backoff, затем DLQ |
| PostgreSQL | Connection lost | SQLAlchemy reconnect с retry, Celery task retry |
| Celery Worker | Crash | Docker restart, задачи забираются другим worker'ом |
| Telegram Bot | Crash | Docker restart, webhook/callback queue обрабатывает позже |

### Retry Policy

- **OpenAI API:** 2 retries, exponential backoff (1s, 5s)
- **Database operations:** SQLAlchemy retry on connection errors
- **Celery tasks:** autoretry_for на временные ошибки, max_retries=2

### Dead Letter Queue

- Задачи после исчерпания retry попадают в DLQ
- Сохраняется: task_id, error message, prompt, LLM response, Excel file path, timestamp
- Telegram alert отправляется владельцу с task_id для reference

### User-Facing Errors

| Scenario | User sees |
|----------|-----------|
| Excel принят | "Файл получен. Обрабатывается..." |
| Project создан | "Проект {name} создан. {N} позиций. {M} зарезервировано со склада." |
| Parsing failed | "Ошибка при обработке файла. Задача #{id} отправлена в очередь ошибок." |
| Service down | "Сервис временно недоступен. Попробуйте позже." |

## Risks and Unknowns

| Risk/Unknown | Why it matters |
|--------------|----------------|
| **Dirty Excel recognition** | LLM может неправильно распознать структуру, нужна fallback стратегия |
| **OpenAI API costs** | Большое количество файлов может увеличить расходы, нужен мониторинг |
| **RabbitMQ setup complexity** | Первая интеграция message broker в проекте, возможны проблемы с конфигурацией |
| **Telegram Bot file size limits** | Excel файлы могут быть большими, нужно handle chunking или rejection |
| **Async debugging** | Сложнее отлаживать flow через queue, нужна хорошая логирование |

## Existing Codebase / Prior Art

| File/Module | How it relates |
|-------------|----------------|
| `backend/models.py` | Использует Project, ProjectItem модели. Нужно добавить DLQ модель. |
| `backend/routers/projects.py` | Existing CRUD endpoints. AI-agent будет вызывать POST /api/projects. |
| `backend/main.py` | FastAPI app. Нужно добавить health check для Celery. |
| `docker-compose.yml` | Existing services. Нужно добавить rabbitmq, celery-worker, telegram-bot. |
| `.env` | Нужно добавить OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_IDS, RABBITMQ_URL. |

## Relevant Requirements

- **R001** — Telegram Bot Gateway (primary owner: M002)
- **R002** — RabbitMQ + Celery Infrastructure (primary owner: M002)
- **R003** — AI-Agent Excel Parser (primary owner: M002)
- **R004** — Flow 1: BOM Upload to Project (primary owner: M002)
- **R005** — DLQ with Context (primary owner: M002)
- **R006** — Telegram Bot Service Isolation (primary owner: M002)

## Scope

### In Scope

- RabbitMQ setup в Docker Compose
- Celery worker infrastructure с retry и DLQ
- Telegram Bot (python-telegram-bot)
- Авторизация по chat_id через .env
- Приём Excel файлов через Telegram
- Парсинг Excel с pandas
- OpenAI GPT-4o для распознавания структуры таблиц
- Создание Project и ProjectItem через существующий API
- DLQ таблица в БД с контекстом ошибок
- Telegram alerts при DLQ
- Health check для всех сервисов

### Out of Scope / Non-Goals

- Email Worker (M003)
- Invoice verification (M003)
- Bank Worker (M004)
- Frontend UI (M005)
- Kanban бизнес-логика с блокировками (M006)
- Резервирование на складе (M006)
- DLQ Admin UI (M005)
- Ролевая модель доступа (M005)

## Technical Constraints

- Python 3.14+ (existing)
- FastAPI (existing)
- SQLAlchemy 2.0 (existing)
- PostgreSQL (existing)
- Docker Compose (existing)
- OpenAI API key required
- Telegram Bot token required
- RabbitMQ 3.x

## Integration Points

| System/Service | Interaction |
|----------------|-------------|
| **Telegram Bot API** | Приём файлов, отправка уведомлений |
| **OpenAI API (GPT-4o)** | Распознавание структуры Excel таблиц |
| **RabbitMQ** | Message broker для Celery tasks |
| **PostgreSQL** | Хранение Projects, ProjectItems, DLQ records |
| **FastAPI (existing)** | REST API для создания Project/ProjectItem |

## Testing Requirements

- Unit tests для Excel parsing (pandas logic)
- Unit tests для LLM prompt construction
- Integration tests для Celery task execution
- Integration tests для Telegram Bot message handling
- E2E test: Excel file → Telegram → Project created
- DLQ scenario test: LLM error → retry → DLQ → alert

## Acceptance Criteria

- RabbitMQ запускается и доступен всем сервисам
- Celery worker обрабатывает задачи из очереди
- Telegram Bot принимает Excel файлы от разрешённых chat_id
- Excel файл сохраняется локально
- Celery task парсит Excel с pandas
- LLM (GPT-4o) распознаёт структуру таблицы (колонки: артикул, название, количество, поставщик)
- Project создаётся через существующий FastAPI endpoint
- ProjectItem создаётся для каждой строки Excel
- Telegram Bot отправляет ответ со статистикой
- При ошибке LLM задача retry'ется 2x
- После исчерпания retry задача попадает в DLQ таблицу
- Владелец получает Telegram alert с task_id
- Health check на /health возвращает статус всех сервисов
- Остановка celery-worker не останавливает telegram-bot и fastapi

## Open Questions

None resolved. All scope questions answered during discussion.