# ZakupPro

Mini-MRP система для автоматизации закупок, управления проектами, складом и финансами в строительных и монтажных проектах.

---

## О проекте

ZakupPro автоматизирует полный цикл от спецификации до оплаты:

1. **Загрузка** — владелец загружает Excel спецификацию через Telegram бот или веб-интерфейс
2. **AI-распознавание** — DeepSeek/OpenAI парсит структуру спецификации и создаёт проект с позициями
3. **Группировка** — система автоматически группирует закупки по поставщикам
4. **Запросы** — отправляет запросы поставщикам (email или вручную)
5. **Счета** — обрабатывает входящие счета из email (IMAP + LLM)
6. **Сверка** — сопоставляет счета с платежами по банковским выпискам (1C ClientBank)
7. **Склад** — обновляет остатки, резервирование, списание в производство

---

## Стек технологий

### Backend
- **Python 3.12+** / FastAPI 0.115 — async REST API с OpenAPI документацией
- **PostgreSQL 15** / SQLAlchemy 2.0 (async) — 16 ORM моделей, Alembic миграции
- **RabbitMQ 3** + Celery 5 — асинхронные задачи, DLQ для failed tasks
- **Passlib** (sha256_crypt) — хеширование паролей, JWT + RBAC (owner/manager/warehouse)

### AI/LLM
- **DeepSeek Chat** — основной провайдер для парсинга Excel и счетов
- **OpenAI GPT-4o** / **Anthropic Claude** / **Google Gemini** — fallback
- **Qwen Plus** — дополнительный провайдер
- Provider-agnostic wrapper с `@retry_async` и автоматическим переключением

### Frontend
- **Next.js 16** (App Router) / React 19 / TypeScript 5
- **Tailwind CSS 4** + **shadcn/ui** (48 Radix UI компонентов)
- **Zustand** — стейт-менеджмент
- **@tanstack/react-query** + **@tanstack/react-table** — данные и таблицы
- **Recharts** — графики и дашборд
- **@dnd-kit** — Kanban drag-and-drop с guardrails
- **react-hook-form** + **zod** — валидация форм
- **Prisma** + SQLite — mock данные в dev mode

### Инфраструктура
- **Docker Compose** — 7 сервисов, health checks, graceful shutdown
- **RabbitMQ Management** — мониторинг очередей и DLQ
- **Nginx** / **Caddy** — reverse proxy

---

## Текущий статус

| Milestone | Статус | Описание |
|-----------|--------|----------|
| M001 | ✅ Pass | DB schema, FastAPI CRUD, Docker |
| M002 | ✅ Pass | RabbitMQ, Celery, Telegram Bot, Excel parsing, AI |
| M003 | ✅ Pass | IMAP ingest, invoice parsing/verification, notifications |
| M004 | ✅ Pass | Bank statement import, payment matching, analytics, export |
| M005 | ✅ Pass | Frontend UI (Next.js + shadcn/ui), Kanban, спецификации |
| M006 | ✅ Pass | Kanban guardrails, stock reservation, readiness matrix |
| M007 | ✅ Pass | Production hardening, RBAC, health endpoints, retry, DLQ admin |

**Последний баг-фикс:** [BUGFIX_SPEC.md](./BUGFIX_SPEC.md) — 8 исправлений, все верифицированы на production.

---

## Архитектура

```
zakuppro/
├── backend/                     # FastAPI backend
│   ├── routers/                 # 17 API роутеров
│   │   ├── analytics.py         # Дашборд, динамика платежей, pipeline
│   │   ├── auth.py              # JWT login + register
│   │   ├── frontend_compat.py   # Frontend-compatible API proxy
│   │   ├── projects.py          # Projects CRUD + status transitions
│   │   ├── suppliers.py         # Suppliers CRUD
│   │   ├── invoices.py          # Invoices CRUD + upload
│   │   ├── payments.py          # Payments CRUD
│   │   ├── stock_items.py       # Warehouse CRUD + receive
│   │   ├── production_tasks.py  # Production tasks
│   │   ├── purchase_orders.py   # Purchase orders
│   │   ├── stats.py             # Aggregated statistics
│   │   ├── admin_failed_tasks.py # DLQ admin UI
│   │   └── ...                  # integration, health, assistant
│   ├── services/                # 14 бизнес-сервисов
│   │   ├── transition_service.py # Kanban guardrails
│   │   ├── stock_service.py     # Резервирование и списание
│   │   ├── invoice_service.py   # Обработка счетов
│   │   ├── payment_matcher.py   # Сверка платежей
│   │   ├── imap_client.py       # IMAP email polling
│   │   └── ...                  # analytics, notifications, LLM
│   ├── models.py                # 16 SQLAlchemy моделей
│   ├── schemas.py               # Pydantic v2 schemas
│   ├── auth.py / rbac.py        # JWT + Role-Based Access Control
│   ├── status_map.py            # Russian ↔ English status mapping
│   ├── celery_app.py            # Celery + DLQ configuration
│   ├── tasks.py                 # Celery tasks (Excel, invoices, bank)
│   ├── email_worker.py          # IMAP polling + attachment routing
│   ├── telegram_bot.py          # Telegram bot for file uploads
│   ├── llm_provider.py          # Multi-LLM wrapper with fallback
│   ├── alembic/                 # Database migrations
│   └── tests/                   # 34 тестовых файла
├── src/                         # Next.js frontend (App Router)
│   ├── app/                     # Страницы + API route proxies
│   ├── components/
│   │   ├── app/                 # 23 бизнес-компонента
│   │   ├── providers/          # Context providers
│   │   └── ui/                  # 48 shadcn/ui компонентов
│   ├── lib/                     # API client, auth, utils
│   ├── types/                   # TypeScript типы
│   ├── store/                   # Zustand stores
│   └── hooks/                   # React hooks
├── docker-compose.yml           # 7 сервисов
├── .env.example                 # Шаблон переменных окружения
├── safe-rebuild.sh              # Zero-downtime rebuild script
└── BUGFIX_SPEC.md               # Спецификация баг-фиксов M007
```

---

## Быстрый старт

### Предварительные требования

- Docker 20.10+ и Docker Compose 2.0+
- 4+ GB RAM (рекомендуется 8 GB)
- 10 GB свободного места на диске

### Установка

```bash
git clone https://github.com/ybatkovsky-jpg/zakuppro.git
cd zakuppro
cp .env.example .env           # Скопируйте и отредактируйте .env
./safe-rebuild.sh --all        # Собрать и запустить все сервисы
```

### Доступ к сервисам

| Сервис | URL | Данные для входа |
|--------|-----|-----------------|
| **Frontend** | http://localhost:3099 | — |
| **API (Swagger)** | http://localhost:8100/docs | — |
| **API Health** | http://localhost:8100/health | — |
| **RabbitMQ UI** | http://localhost:15672 | `guest / guest` |
| **API Login** | POST http://localhost:8100/api/auth/login | `admin / admin123` |

### Docker сервисы (7 штук)

| Сервис | Описание | Health Check |
|--------|----------|-------------|
| `db` | PostgreSQL 15 (persistent volume) | `pg_isready` |
| `rabbitmq` | Message broker + management UI | RabbitMQ health |
| `api` | FastAPI backend | `GET /health` (multi-service) |
| `celery-worker` | Async task processing | Celery inspect |
| `email-worker` | IMAP polling + invoice routing | Heartbeat file |
| `telegram-bot` | Telegram bot for uploads | Heartbeat file |
| `frontend` | Next.js UI | HTTP 200 response |

---

## Переменные окружения

Полный шаблон в `.env.example`. Ключевые группы:

```bash
# База данных
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_ME
DATABASE_URL=postgresql+psycopg2://postgres:CHANGE_ME@db:5432/zakuppro

# JWT (обязательно заменить в production!)
JWT_SECRET_KEY=CHANGE_ME_MIN_32_CHARS
SECRET_KEY=CHANGE_ME_MIN_32_CHARS

# LLM
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_OWNER_CHAT_ID=your_chat_id
ALLOWED_CHAT_IDS=your_chat_id

# Email (опционально)
IMAP_HOST=imap.gmail.com
IMAP_USER=your_email@gmail.com
IMAP_PASS=your_app_password
```

> ⚠️ **Важно:** Файл `.env` исключён из git (в `.gitignore`). Никогда не коммитьте секреты.

---

## API Endpoints

67 endpoints в 17 роутерах:

| Группа | Endpoints | Описание |
|--------|-----------|----------|
| **Health** | `GET /health` | Multi-service health check (DB, RabbitMQ, Celery, workers) |
| **Auth** | `POST /login`, `POST /register`, `GET /users/me` | JWT + RBAC |
| **Projects** | CRUD + `/status`, `/readiness`, `/check-duplicate`, `/upload`, `/export` | Проекты и позиции |
| **Suppliers** | CRUD | Поставщики |
| **Invoices** | CRUD + `/upload`, `/reconcile` | Счета |
| **Payments** | CRUD | Платежи |
| **Stock** | CRUD + `/receive` | Складские остатки |
| **Purchase Orders** | CRUD | Заказы поставщикам |
| **Production Tasks** | CRUD | Производственные задачи |
| **Analytics** | `/dashboard`, `/payment-dynamics`, `/pipeline`, `/suppliers` | Аналитика |
| **Stats** | `GET /api/stats`, `GET /api/activity`, `GET /api/deliveries` | Агрегированная статистика |
| **Admin** | `/failed-tasks`, `/failed-tasks/{id}/retry` | DLQ admin |
| **Integration** | `/v1/integration/projects/{contract}/procurement` | Внешняя интеграция |

---

## Роли и доступ (RBAC)

| Роль | Права |
|------|-------|
| **Owner** | Полный доступ ко всем сущностям и настройкам |
| **Manager** | CRUD проектов/поставщиков/счетов; чтение аналитики |
| **Warehouse** | CRUD склада; ограниченный доступ к другим модулям |

JWT-токен содержит `user_id` и `role`. Все защищённые endpoints используют `Depends(require_role(...))`.

---

## Kanban Guardrails

Переходы между статусами проектов валидируются через `can_transition_to()`:

```
new → processing → requested → invoiced → paid → delivered → completed
```

Недопустимые переходы (например, `completed → new`) возвращают **422 Unprocessable Entity**.

Дополнительно: переход в "В производстве" требует, чтобы все ProjectItem были "На складе" или "Оплачено" (проверка через `transition_service`).

---

## Observability

- **Health Check:** `GET /health` проверяет DB, RabbitMQ, Celery worker, Email worker, Telegram bot
- **Heartbeat:** Email worker и Telegram bot пишут heartbeat-файл каждые 30 секунд
- **Логирование:** Структурированные логи в stdout, файловые логи в `/data/logs/`
- **RabbitMQ UI:** http://localhost:15672 — мониторинг очередей, DLQ, потребителей
- **API Docs:** http://localhost:8100/docs — Swagger UI с моделями и примерами

---

## Деплой в production

```bash
# Zero-downtime rebuild
./safe-rebuild.sh --all

# Миграции БД
docker exec -w /app/backend zakuppro-api alembic upgrade head

# Логи
docker compose logs -f api
docker compose logs -f celery-worker
docker compose logs -f email-worker
docker compose logs -f telegram-bot

# Перезапуск одного сервиса
docker compose up -d --build api
```

> ⚠️ **Не используйте** `docker-compose down -v` — это удалит все данные (БД, processed IDs, heartbeat).

---

## Тестирование

```bash
# Все тесты (в контейнере)
docker exec zakuppro-api pytest /app/backend/tests/ -v

# Конкретный модуль
docker exec zakuppro-api pytest /app/backend/tests/test_transition_service.py -v

# С покрытием
docker exec zakuppro-api pytest /app/backend/tests/ --cov=backend -v
```

34 тестовых файла покрывают: модели, API, RBAC, transition service, LLM provider, IMAP, invoice parsing, bank statements, stock service, email worker.

---

## Архитектурные решения

### Backend
- **Модульные роутеры** — отдельный файл на домен (17 роутеров)
- **RBAC middleware** — `require_role()` + `require_ownership()` dependencies
- **Kanban guardrails** — `can_transition_to()` + `transition_service` бизнес-проверки
- **Status mapping** — `status_map.py` для двустороннего RU ↔ EN перевода
- **lazy='selectin'** — предотвращение N+1 запросов в SQLAlchemy
- **LLM fallback** — DeepSeek → OpenAI → Claude → Gemini с `@retry_async`
- **FailedTask DLQ** — персистентность failed Celery tasks для retry/inspection
- **Stock reservation** — reserve → write-off → receive с invariant enforcement

### Frontend
- **App Router** — Next.js 16 с серверными и клиентскими компонентами
- **API proxy** — route handlers проксируют к FastAPI backend
- **Zustand** — централизованный стейт-менеджмент
- **shadcn/ui** — 48 компонентов на Radix UI primitives

### Безопасность
- `.env` исключён из git
- JWT с криптографически стойким секретом (минимум 32 символа)
- sha256_crypt для хеширования паролей
- RBAC на всех защищённых endpoints

---

## Лицензия

Proprietary — для «ПРОМЕБЕЛЬ»
