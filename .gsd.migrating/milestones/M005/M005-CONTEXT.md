# M005: Frontend UI Integration

**Status:** Active
**Phase:** executing

## Vision

Интегрировать Next.js frontend с FastAPI backend, добавить drag-and-drop для Kanban доски проектов, реализовать базовую ролевую модель для разграничения доступа.

## Success Criteria

- Frontend интегрирован с FastAPI backend через API проксирование
- Kanban доска поддерживает drag-and-drop с валидацией переходов
- Analytics дашборд показывает реальные данные из PostgreSQL
- Базовая ролевая модель (owner/manager/warehouse) реализована
- Приложение готово к deployment в Docker Compose

## Constraints

### From Previous Milestones

**From M001 (DB + FastAPI CRUD):**
- SQLAlchemy ORM модели с relationships
- FastAPI CRUD endpoints для всех entities
- PostgreSQL schema с indexes

**From M002 (Async Core + AI-Agent):**
- RabbitMQ + Celery infrastructure
- Telegram Bot service
- FailedTask модель для DLQ

**From M003 (Email + Invoice Processing):**
- Invoice, InvoiceItem модели
- Invoice verification API
- Email notifications

**From M004 (Bank Integration):**
- BankStatement, BankTransaction модели
- UnresolvedTransaction CRUD API
- Analytics endpoints (/api/analytics/dashboard, /api/analytics/payment-dynamics)

### To Next Milestones

**To M006 (Business Logic Polish):**
- Frontend компоненты готовы для Kanban бизнес-логики
- RBAC middleware можно расширить для finer-grained permissions
- Аналитика готова для матрицы готовности проекта

## Key Decisions

- Frontend proxies to FastAPI, not direct Prisma access (MEM092)
- @dnd-kit for Kanban drag-and-drop (MEM093)
- Next.js 16.1.1 with App Router and Shadcn UI components

## Technical Context

### Frontend Stack
- Next.js 16.1.1 with App Router
- Shadcn UI components (Radix UI primitives)
- TypeScript for type safety
- @dnd-kit for Kanban drag-and-drop

### Backend Stack
- FastAPI with SQLAlchemy 2.0 ORM
- PostgreSQL database
- Pydantic v2 schemas for all entities
- Routers: projects, suppliers, invoices, analytics, unresolved_transactions, etc.

## Architecture

### API Proxy Pattern
Next.js API routes will act as pure proxies to FastAPI:
```
Frontend Component → Next.js API Route → FastAPI → PostgreSQL
```

No business logic in Next.js API routes. All CRUD operations flow through FastAPI backend.

### Integration Boundaries

**S01 → S02/S03/S04:**
- API клиент с TypeScript типами используется всеми последующими слайсами
- Проксирование Next.js → FastAPI настроено один раз в S01

**S02 → S04:**
- DnD изменения статуса проходят через RBAC middleware

**S01/S03 → S05:**
- Production build использует реальные API endpoints
- Docker compose конфиг включает все сервисы

## Slices Overview

1. **S01: Frontend-Backend API Integration** (active)
   - Replace Prisma-based Next.js API routes with FastAPI proxy routes
   - Create centralized API client with TypeScript types
   - Verify: curl to /api/* endpoints returns FastAPI data

2. **S02: Kanban Drag-and-Drop**
   - Implement drag-and-drop for project status transitions
   - Validate transitions against VALID_TRANSITIONS
   - Update status through FastAPI

3. **S03: Analytics Dashboard Real Data**
   - Connect dashboard to FastAPI analytics endpoints
   - Display metrics: paid/unpaid counts, total amounts
   - Payment dynamics time-series charts

4. **S04: Role-Based Access Control (RBAC)**
   - Implement basic role model: owner/manager/warehouse
   - Middleware for permission checks
   - 403 responses for unauthorized access

5. **S05: Production Readiness Polish**
   - Docker Compose configuration
   - Health checks for all services
   - Smoke test: create → update → delete project

## Current Status

**Phase:** executing
**Active Slice:** S01 - Frontend-Backend API Integration
**Active Task:** T02 - Replace Projects API Routes with FastAPI Proxy

### Progress
- T01: ✅ Create API Client Utility and TypeScript Types
- T02-T07: Pending
