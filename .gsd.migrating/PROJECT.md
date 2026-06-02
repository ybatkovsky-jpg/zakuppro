# PROJECT.md

## What This Is

ZakupPro — Mini-MRP система для мебельного производства "ПРОМЕБЕЛЬ". Автоматизация закупок, управления проектами, складом и финансами.

**Current state:** M001 completed (DB schema + FastAPI CRUD). M002 completed (Async core + AI-Agent Foundation). M003 completed (Email + Invoice Processing).

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

**M003 — Completed (verdict: pass):**
- IMAP ingest service (imap_client.py) with SSL/TLS, polling, attachment extraction
- Email Worker Docker service with 17 environment variables, healthcheck, restart policy
- LLM provider wrapper (llm_provider.py) with OpenAI/Gemini/Claude support and automatic fallback
- Invoice BLOB storage (Invoice.raw_file BYTEA, Invoice.verification_result JSONB, InvoiceItem table)
- Invoice parsing with PDF (pdfplumber) and Excel (pandas) support
- Invoice verification with fuzzy matching (RapidFuzz 85% threshold), exact SKU matching, quantity discrepancy detection
- Notifications: Telegram (verified/partial/clarification_needed/failed) + SMTP clarification emails to suppliers
- Non-blocking notification pattern (errors logged, don't block pipeline)
- 221 tests passing with 81% coverage for new milestone components
- E2E integration tests (13 tests) validating parse → verify → notify pipeline
- Dirty invoice fixtures validated (merged cells, Russian content)

**M004-M006 — Queued:**
- M004: Bank Integration + Financials
- M005: Frontend UI (Next.js + Ant Design)
- M006: Business Logic Polish (Kanban, комплектация, склад)

## Architecture / Key Patterns

**Tech Stack:**
- Backend: Python (FastAPI), SQLAlchemy 2.0, PostgreSQL
- AI: OpenAI GPT-4o, Gemini, Claude (provider-agnostic wrapper)
- Message Queue: RabbitMQ + Celery
- Bot: python-telegram-bot v21+
- Email: imaplib (IMAP), aiosmtplib (SMTP)
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
- LLM provider wrapper with automatic fallback on transient errors
- Non-blocking notification pattern (log errors, return False, don't block pipeline)
- IMAP polling with Message-ID persistence for duplicate detection
- Graceful shutdown via SIGTERM/SIGINT handlers
- call_task() helpers for testing Celery tasks without @app.task wrapper

**Integration Points:**
- Telegram Bot → RabbitMQ → Celery Workers → FastAPI → PostgreSQL
- Email Worker → IMAP/SMTP → RabbitMQ → AI-Agent
- Bank Worker → Bank API → PostgreSQL

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract.

## Milestone Sequence

- [x] M001: Foundation — DB schema, FastAPI CRUD, Docker
- [x] M002: Asynchronous Core + AI-Agent Foundation — RabbitMQ, Celery, Telegram Bot, Excel parsing, DLQ
- [x] M003: Email + Invoice Processing — IMAP ingest, invoice parsing/verification, notifications
- [ ] M004: Bank Integration + Financials — bank statement import, payment mapping
- [ ] M005: Frontend UI — Next.js, Kanban, specifications tables
- [ ] M006: Business Logic Polish — Kanban transitions, stock reservation, readiness matrix
