# PROJECT.md

## What This Is

ZakupPro — Mini-MRP система для мебельного производства "ПРОМЕБЕЛЬ". Автоматизация закупок, управления проектами, складом и финансами.

**Current state:** M001 completed (DB schema + FastAPI CRUD). M002 completed (Async core + AI-Agent Foundation).

## Core Value

**End-to-end automation from BOM to paid invoices:**

Владелец кидает Excel файл в Telegram → система распознаёт спецификацию → создаёт проект → группирует закупки → отправляет запросы поставщикам → сверяет счета → связывает платежи → обновляет склад.

Если всё остальное вырезать, это должно работать.

## Project Shape

- **Complexity:** complex
- **Why:** 5 контуров (Web App, Telegram Bot, AI-Agent, Email Worker, Bank Worker), LLM интеграция, message broker, state machines, multiple external services.

## Current State

**M001 — Completed (verdict: pass):**
- PostgreSQL schema с 9 таблицами
- SQLAlchemy 2.0 ORM с 19 relationship
- FastAPI с ~45 CRUD endpoints
- Docker контейнеризация
- Базовые тесты (58 tests)
- Health check endpoint + CORS middleware

**M002 — Completed (verdict: pass):**
- RabbitMQ 3-management с DLQ configuration
- Celery worker infrastructure с health check
- Telegram Bot service (python-telegram-bot v21+)
- AI-Agent Worker (pandas + OpenAI GPT-4o для Excel parsing)
- End-to-end flow: Telegram upload → AI parsing → Project/ProjectItem DB creation → Telegram notification
- FailedTask model для DLQ persistence
- Supplier auto-creation с python-slugify
- Telegram notifier для completion и DLQ alerts

**M003-M006 — Queued:**
- M003: Email Worker + Invoice Processing
- M004: Bank Integration + Financials
- M005: Frontend UI (Next.js + Ant Design)
- M006: Business Logic Polish (Kanban, комплектация, склад)

## Architecture / Key Patterns

**Tech Stack:**
- Backend: Python (FastAPI), SQLAlchemy 2.0, PostgreSQL
- AI: OpenAI GPT-4o
- Message Queue: RabbitMQ + Celery
- Bot: python-telegram-bot v21+
- Frontend: Next.js + React + Ant Design (планируется)

**Patterns:**
- Modular routers per entity (projects.py, suppliers.py, etc.)
- Cascade delete только для иерархических связей
- lazy='selectin' для предотвращения N+1
- Docker Compose сервисы общаются по service names
- Celery task с bind=True для retry access
- GPT-4o response_format=json_schema для 100% valid output
- Pandas fillna('') перед markdown conversion для AI context
- Authorization middleware с environment-based ALLOWED_CHAT_IDS
- Fail-fast health endpoint (503 на любой degradation)

**Integration Points:**
- Telegram Bot → RabbitMQ → Celery Workers → FastAPI → PostgreSQL
- Email Worker → IMAP/SMTP → RabbitMQ → AI-Agent
- Bank Worker → Bank API → PostgreSQL

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract.

## Milestone Sequence

- [x] M001: Foundation — DB schema, FastAPI CRUD, Docker
- [x] M002: Asynchronous Core + AI-Agent Foundation — RabbitMQ, Celery, Telegram Bot, Excel parsing, DLQ
- [ ] M003: Email + Invoice Processing — SMTP outbound, invoice verification
- [ ] M004: Bank Integration + Financials — bank statement import, payment mapping
- [ ] M005: Frontend UI — Next.js, Kanban, specifications tables
- [ ] M006: Business Logic Polish — Kanban transitions, stock reservation, readiness matrix