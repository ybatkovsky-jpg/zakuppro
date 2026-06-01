# PROJECT.md

## What This Is

ZakupPro — Mini-MRP система для мебельного производства "ПРОМЕБЕЛЬ". Автоматизация закупок, управления проектами, складом и финансами.

**Current state:** M001 completed (DB schema + FastAPI CRUD). M002 in planning (Async core + AI-Agent).

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

**M002 — In planning:**
- RabbitMQ + Celery infrastructure
- Telegram Bot Gateway
- AI-Agent Worker (Excel parsing + OpenAI)
- Flow 1: Загрузка BOM → создание Project

**M003-M006 — Queued:**
- M003: Email Worker + Invoice Processing
- M004: Bank Integration + Financials
- M005: Frontend UI (Next.js + Ant Design)
- M006: Business Logic Polish (Kanban, комплектация, склад)

## Architecture / Key Patterns

**Tech Stack:**
- Backend: Python (FastAPI), SQLAlchemy 2.0, PostgreSQL
- AI: LangChain/LangGraph, OpenAI GPT-4o
- Message Queue: RabbitMQ + Celery
- Bot: python-telegram-bot (или aiogram)
- Frontend: Next.js + React + Ant Design (планируется)

**Patterns:**
- Modular routers per entity (projects.py, suppliers.py, etc.)
- Cascade delete только для иерархических связей
- lazy='selectin' для предотвращения N+1
- Docker Compose сервисы общаются по service names

**Integration Points:**
- Telegram Bot → RabbitMQ → Celery Workers → FastAPI → PostgreSQL
- Email Worker → IMAP/SMTP → RabbitMQ → AI-Agent
- Bank Worker → Bank API → PostgreSQL

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract.

## Milestone Sequence

- [x] M001: Foundation — DB schema, FastAPI CRUD, Docker
- [ ] M002: Asynchronous Core + AI-Agent Foundation — RabbitMQ, Celery, Telegram Bot, Excel parsing
- [ ] M003: Email + Invoice Processing — SMTP outbound, invoice verification
- [ ] M004: Bank Integration + Financials — bank statement import, payment mapping
- [ ] M005: Frontend UI — Next.js, Kanban, specifications tables
- [ ] M006: Business Logic Polish — Kanban transitions, stock reservation, readiness matrix