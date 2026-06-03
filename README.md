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
- **TypeScript 5**
- **Tailwind CSS 4** + shadcn/ui (Radix UI)
- **@dnd-kit** для Kanban drag-and-drop
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
| M005 | 🚧 In Progress | Frontend UI, RBAC, auth, production deployment |
| M006 | 📋 Queued | Business Logic Polish (Kanban, комплектация, склад) |

## Структура проекта

```
zakuppro/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # FastAPI routers (projects, suppliers, invoices...)
│   │   ├── core/        # Config, security, database
│   │   ├── models/      # SQLAlchemy ORM models
│   │   ├── schemas/     # Pydantic v2 schemas
│   │   ├── services/    # Business logic (LLM, matching, verification)
│   │   └── workers/     # Celery tasks, email worker, telegram bot
│   ├── tests/           # Pytest tests (500+ passing)
│   ├── alembic/         # Database migrations
│   └── requirements.txt # Python dependencies
├── mini-services/       # Frontend services
│   └── telegram-bot/    # Next.js Telegram Web App
├── .gsd/                # GSD project management (artifacts, milestones)
├── docker-compose.yml   # All services orchestration
├── .env                 # Environment variables (template)
└── README.md           # This file
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

```bash
# Запуск всех сервисов
docker-compose up -d

# Проверка здоровья
curl http://localhost:8000/health

# Логи
docker-compose logs -f api
docker-compose logs -f celery-worker
docker-compose logs -f telegram-bot
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

Создайте `.env` файл в корне проекта:

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

Запущено на `http://localhost:8000`

- `GET /health` — Health check
- `POST /api/auth/login` — JWT authentication
- `GET /api/projects` — List projects
- `POST /api/projects` — Create project
- `GET /api/suppliers` — List suppliers
- `POST /api/invoices/upload` — Upload invoice for parsing
- `GET /api/analytics/dashboard` — Dashboard metrics
- `GET /docs` — Interactive API documentation (Swagger)

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

**Текущее покрытие:** 81% для новых компонентов, ~500 тестов passing.

## Роли пользователей (M005)

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

### Observability (M005)

- **Логирование:** Структурированные JSON-логи (stdout) с `request_id` корреляцией
- **Метрики:** Prometheus + Grafana (system health, business metrics, Celery queue)
- **Alerts:** Telegram для критических событий

### Деплой

```bash
# Production build
docker-compose -f docker-compose.prod.yml up -d

# Или отдельные сервисы
docker-compose up -d db rabbitmq api celery-worker telegram-bot
```

## Архитектурные решения

### Patterns
- **Modular routers** — отдельный роутер на сущность (projects.py, suppliers.py)
- **Cascade delete** — только для иерархических связей (Project → ProjectItem)
- **lazy='selectin'** — предотвращение N+1 запросов
- **LLM provider wrapper** — автоматический fallback на transient errors
- **Non-blocking notifications** — ошибки логируются, не блокируют pipeline
- **FailedTask DLQ** — персистентность failed Celery tasks для retry/inspection

### Database
- **SQLAlchemy 2.0** с async/await
- **relationship(back_populates=...)** — bidirectional relationships
- **JSONB** для гибких полей (verification_result, parsed_data)

### Message Queue
- **RabbitMQ 3-management** с DLQ configuration
- **Celery** с bind=True для retry access
- **Health check** на всех workers

## Лицензия

Proprietary — для "ПРОМЕБЕЛЬ"

## Поддержка

Для вопросов и проблем создавайте issues в репозитории.
