# ZakupPro

Mini-MRP система для автоматизации закупок, управления проектами, складом и финансами в строительных и монтажных проектах.

## О проекте

ZakupPro автоматизирует полный цикл от спецификации до оплаты:

1. Владелец загружает Excel спецификацию через Telegram бот
2. AI распознаёт структуру и создаёт проект с позициями
3. Система группирует закупки по поставщикам
4. Отправляет запросы поставщикам (автоматически или вручную)
5. Обрабатывает входящие счета из email
6. Сверяет счета с платежами по банковским выпискам
7. Обновляет остатки на складе

Если всё остальное вырезать — этот flow должен работать.

## Стек технологий

### Backend
- **Python 3.12+** с FastAPI 0.115
- **PostgreSQL 15** с SQLAlchemy 2.0 ORM
- **RabbitMQ 3** + Celery 5 для асинхронных задач
- **Alembic** для миграций БД

### AI/LLM
- **OpenAI GPT-4o** для парсинга Excel и счетов
- **Anthropic Claude** и **Google Gemini** как fallback
- Провайдер-agnostic wrapper с автоматическим переключением

### Frontend
- **Next.js 16.1.1** с App Router
- **React 19** + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** (Radix UI primitives)
- **Zustand** для стейт-менеджмента
- **@tanstack/react-query** + **@tanstack/react-table**
- **Recharts** для графиков, **Framer Motion** для анимаций
- **@dnd-kit** для Kanban drag-and-drop
- **react-hook-form** + **zod** для валидации форм
- **Prisma** с SQLite для mock данных (dev mode)

### Интеграции
- **Telegram Bot** (python-telegram-bot v21+) для загрузки файлов
- **IMAP/SMTP** для обработки входящих счетов
- **1C ClientBank** формат для банковских выписок

## Текущий статус

| Milestone | Статус | Описание |
|-----------|--------|----------|
| M001 | ✅ Pass | DB schema, FastAPI CRUD, Docker, 58 tests |
| M002 | ✅ Pass | RabbitMQ, Celery, Telegram Bot, Excel parsing, AI integration |
| M003 | ✅ Pass | IMAP ingest, invoice parsing/verification, notifications, 221 tests |
| M004 | ✅ Pass | Bank statement import, payment matching, analytics, export, 237 tests |
| M005 | ✅ Pass | Frontend UI (Next.js + shadcn/ui), Kanban, таблицы спецификаций |
| M006 | ✅ Pass | Business Logic Polish: Kanban guardrails, stock reservation, readiness matrix |
| M007 | ✅ Pass | Production Hardening: graceful shutdown, health endpoints, retry, RBAC UI, DLQ admin, 257 tests |

## Структура проекта

```
zakuppro/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── routers/         # FastAPI routers (12 модулей)
│   │   ├── models.py        # SQLAlchemy ORM (17 моделей)
│   │   ├── schemas/         # Pydantic v2 schemas
│   │   ├── services/        # Business logic (8 сервисов)
│   │   ├── tasks.py         # Celery tasks (~59KB)
│   │   ├── workers/         # Email worker, Telegram bot
│   │   ├── llm_provider.py  # Multi-LLM wrapper (OpenAI/Claude/Gemini)
│   │   └── handlers/        # Telegram bot handlers
│   ├── tests/               # Pytest tests (36+ файлов)
│   ├── alembic/             # Database migrations
│   └── requirements.txt
├── src/                     # Next.js frontend (App Router)
│   ├── app/                 # Страницы и API route proxies
│   ├── components/          # React компоненты (app/ + ui/)
│   ├── lib/                 # API client, auth, утилиты
│   ├── types/               # TypeScript типы для FastAPI
│   ├── store/               # Zustand state management
│   └── hooks/               # React hooks
├── mini-services/           # Микросервисы
│   └── telegram-bot/        # Standalone Telegram Web App (Bun + TS)
├── prisma/                  # Prisma schema (SQLite для dev)
├── scripts/                 # Утилиты (smoke-test.sh, start-dev.sh)
├── .gsd/                    # GSD project management
├── docker-compose.yml       # Оркестрация всех сервисов
├── .env.example             # Шаблон переменных окружения
└── README.md
```

## Быстрый старт

### Требования

- Docker & Docker Compose
- Python 3.12+ (для локального запуска backend)
- Node.js 20+ / Bun (для frontend)
- PostgreSQL 15+ (или используйте Docker)

### 1. Клонирование и настройка

```bash
git clone <repo-url>
cd zakuppro
cp .env.example .env  # Отредактируйте .env с вашими ключами
```

### 2. Запуск через Docker (рекомендуется)

**Prerequisites:**
- Docker 20.10+
- Docker Compose 2.0+

**Quick Start:**
```bash
# Запуск всех сервисов
docker-compose up -d

# Проверка статуса сервисов
docker-compose ps

# Smoke test (валидация полного цикла CRUD с авторизацией)
bash scripts/smoke-test.sh
```

**Service URLs:**
| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | — |
| Backend API | http://localhost:8000 | `admin / admin123` (default) |
| API Docs | http://localhost:8000/docs | — |
| RabbitMQ UI | http://localhost:15672 | `guest / guest` |
| PostgreSQL | localhost:5432 | `postgres / postgres` |

**Services Description:**
1. **db** — PostgreSQL 15 database (persistent volume)
2. **api** — FastAPI backend with health check
3. **rabbitmq** — Message broker with management UI
4. **email-worker** — IMAP invoice ingest + LLM parsing
5. **celery-worker** — Async task processing (LLM fallback, matching)
6. **telegram-bot** — Telegram bot for file uploads
7. **frontend** — Next.js UI (App Router + shadcn/ui)

**Logs & Troubleshooting:**
```bash
# Логи конкретного сервиса
docker-compose logs -f api
docker-compose logs -f celery-worker
docker-compose logs -f telegram-bot
docker-compose logs -f email-worker

# Все логи
docker-compose logs

# Перезапуск сервиса
docker-compose restart api

# Полная остановка и удаление volumes (сброс данных)
docker-compose down -v
```

**Common Issues:**
- **Port conflicts**: Измените порты в `docker-compose.yml` если заняты
- **DB connection timeout**: Подождите ~10s после запуска для healthcheck
- **RabbitMQ slow**: Management UI доступен после ~30s (start_period)
- **LLM failures**: Проверьте `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` в `.env`

**Shutdown:**
```bash
# Остановка сервисов (сохранение данных)
docker-compose down

# Полная очистка включая volumes
docker-compose down -v
```

### 3. Локальный запуск (development)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
npm install          # или bun install
npm run dev          # http://localhost:3000
```

**Celery Worker:**
```bash
cd backend
celery -A backend.celery_app worker --loglevel=info
```

**Telegram Bot:**
```bash
cd backend
python -m backend.telegram_bot
```

**Email Worker:**
```bash
cd backend
python -m backend.email_worker
```

## Переменные окружения

Создайте `.env` файл в корне проекта (см. `.env.example` для шаблона):

```bash
# Database
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/zakuppro
DATABASE_URL_ASYNC=postgresql+asyncpg://postgres:postgres@localhost:5432/zakuppro

# RabbitMQ (для Celery)
CELERY_BROKER_URL=pyamqp://guest:guest@rabbitmq:5672//
REDIS_URL=redis://localhost:6379/0

# LLM Provider
LLM_PRIMARY_PROVIDER=openai
LLM_SECONDARY_PROVIDER=anthropic
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_OWNER_CHAT_ID=your_chat_id
ALLOWED_CHAT_IDS=123456789,987654321

# Email (SMTP/IMAP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your_email@gmail.com
IMAP_PASS=your_app_password

# Security
SECRET_KEY=your-secret-key-change-in-production
```

## API Endpoints

Запущено на `http://localhost:8000`, 12 роутеров.

| Категория | Endpoints |
|-----------|-----------|
| Health | `GET /health` — multi-service health check (DB, RabbitMQ, Celery, workers) |
| Auth | `POST /api/auth/login` — JWT authentication |
| Projects | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/{id}` |
| Project Items | `GET/POST /api/project-items`, `PUT/DELETE /api/project-items/{id}` |
| Suppliers | `GET/POST /api/suppliers`, `PUT/DELETE /api/suppliers/{id}` |
| Stock | `GET/POST /api/stock-items`, `POST /api/stock-items/receive` |
| Invoices | `GET/POST /api/invoices`, `POST /api/invoices/upload` |
| Payments | `GET/POST /api/payments` |
| Purchase Orders | `GET/POST /api/purchase-orders` |
| Production Tasks | `GET/POST /api/production-tasks` |
| Unresolved Transactions | `GET/POST /api/unresolved-transactions`, search, bulk operations |
| Analytics | `GET /api/analytics/dashboard`, `/payment-dynamics`, `/pipeline`, `/suppliers` |
| Docs | `GET /docs` — Swagger UI |

## Тестирование

```bash
cd backend

# Все тесты
pytest

# С покрытием
pytest --cov=app --cov-report=html

# Конкретный milestone
pytest tests/m001/
pytest tests/m004/
```

**Текущее покрытие:** 36+ тестовых файлов, 257 тестов, все 7 milestones завершены.

## Роли пользователей

| Роль | Права |
|------|-------|
| **Admin** | Полный доступ ко всем сущностям и настройкам |
| **Менеджер** | CRUD проектов, поставщиков, счетов; чтение аналитики |
| **Бухгалтер-аналитик** | Финансы (счета, выписки, аналитика), поставщики; чтение проектов/склада |
| **Кладовщик** | CRUD склада; чтение проектов |
| **Технолог-монтажник** | Чтение/обновление проектов, чтение склада, добавление поставщиков |
| **Закупщик** | CRUD suppliers/invoices/warehouse, чтение/обновление projects, чтение analytics |

Поддерживается множественные роли на одного пользователя (JWT с `roles: []`).

## Развертывание в продакшене

### Production Hardening (M007) ✅

Завершён. Ключевые improvements:
- **Graceful shutdown** — все сервисы (FastAPI, Celery, Email Worker, Telegram Bot) с SIGTERM/SIGINT handlers
- **Health endpoints** — multi-service health check с fail-fast (503 при деградации любого сервиса), shared volume для heartbeat-синхронизации между контейнерами
- **Retry с exponential backoff** — `@retry_async`/`@retry_sync` для LLM, email, Telegram, bank statement
- **RBAC UI** — 6 ролей (owner, manager, warehouse, purchaser, accountant, technician), sidebar filtering, per-component visibility gating, LoginPage с роль-специфичным доступом
- **DLQ Admin UI** — страница неудачных задач (failed-tasks) для owner, просмотр и повторная обработка

### Observability

- **Логирование:** Структурированные JSON-логи (stdout) с `request_id` корреляцией
- **Метрики:** Prometheus + Grafana (system health, business metrics, Celery queue)
- **Alerts:** Telegram для критических событий

### Деплой

```bash
# Production build (все 7 сервисов)
docker-compose up -d

# Или выборочно
docker-compose up -d db rabbitmq api celery-worker telegram-bot email-worker frontend
```

## Архитектурные решения

### Backend Patterns
- **Modular routers** — отдельный роутер на сущность (12 роутеров)
- **Cascade delete** — только для иерархических связей (Project → ProjectItem)
- **lazy='selectin'** — предотвращение N+1 запросов
- **LLM provider wrapper** — Strategy pattern, автоматический fallback (OpenAI → Claude → Gemini)
- **Non-blocking notifications** — ошибки логируются, не блокируют pipeline
- **FailedTask DLQ** — персистентность failed Celery tasks для retry/inspection
- **Retry с exponential backoff** — декораторы `@retry_async`/`@retry_sync` для внешних вызовов
- **RBAC** — 6 ролей, множественные роли на пользователя, JWT-based
- **Stock reservation** — reserve → write-off → receive с invariant enforcement
- **Kanban guardrails** — `can_transition_to()` с PRODUCTION_READY_STATUSES

### Frontend Patterns
- **App Router** — Next.js 16 с серверными и клиентскими компонентами
- **API proxy** — 43 route handlers для проксирования к FastAPI backend
- **Zustand** — централизованный стейт-менеджмент
- **shadcn/ui** — 40+ UI компонентов на Radix primitives

### Database
- **SQLAlchemy 2.0** с async/await
- **relationship(back_populates=...)** — bidirectional relationships
- **JSONB** для гибких полей (verification_result, parsed_data)
- **17 ORM моделей** — от Project до TransactionMatchingAudit

### Message Queue
- **RabbitMQ 3-management** с DLQ configuration
- **Celery** с bind=True для retry access
- **Health check** на всех workers

## Лицензия

Proprietary — для "ПРОМЕБЕЛЬ"

## Поддержка

Для вопросов и проблем создавайте issues в репозитории.
