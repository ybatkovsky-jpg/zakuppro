# M005: Frontend UI Integration

**Vision:** Интегрировать Next.js frontend с FastAPI backend, добавить drag-and-drop для Kanban доски проектов, реализовать базовую ролевую модель для разграничения доступа.

## Success Criteria

- Frontend интегрирован с FastAPI backend через API проксирование
- Kanban доска поддерживает drag-and-drop с валидацией переходов
- Analytics дашборд показывает реальные данные из PostgreSQL
- Базовая ролевая модель (owner/manager/warehouse) реализована
- Приложение готово к deployment в Docker Compose

## Slices

- [x] **S01: S01** `risk:high` `depends:[]`
  > After this: Frontend компоненты (Projects, Invoices, Analytics) получают данные через FastAPI endpoints. Проверяется curl-ом к /api/projects, /api/invoices, /api/analytics/dashboard.

- [x] **S02: S02** `risk:medium` `depends:[]`
  > After this: Пользователь может перетащить карточку проекта из колонки 'Новые' в 'В обработке'. Статус обновляется в БД через FastAPI. Переходы подчиняются правилам VALID_TRANSITIONS.

- [ ] **S03: S03** `risk:medium` `depends:[]`
  > After this: Дашборд показывает метрики из FastAPI: paid_invoices_count, unpaid_invoices_count, total_paid_amount, total_unpaid_amount. Графики payment dynamics рендерятся данными из /api/analytics/payment-dynamics.

- [ ] **S04: Role-Based Access Control (RBAC)** `risk:high` `depends:[S01]`
  > After this: Пользователь 'manager' видит только свои проекты. Пользователь 'warehouse' видит только склад. Пользователь 'owner' видит всё. Попытка доступа к чужим данным возвращает 403.

- [ ] **S05: Production Readiness Polish** `risk:low` `depends:[S01,S02,S03,S04]`
  > After this: Приложение запускается в Docker Compose. Frontend на порту 3000, backend на 8000. Все healthchecks green. Smoke test проходит: создать проект → обновить статус → удалить.

## Boundary Map

## Boundary Map: M005 Frontend UI Integration

### Входные границы (контракт от предыдущих milestone)

**От M001 (DB + FastAPI CRUD):**
- SQLAlchemy ORM модели с relationships
- FastAPI CRUD endpoints для всех entities
- PostgreSQL schema с indexes

**От M002 (Async Core + AI-Agent):**
- RabbitMQ + Celery infrastructure
- Telegram Bot service
- FailedTask модель для DLQ

**От M003 (Email + Invoice Processing):**
- Invoice, InvoiceItem модели
- Invoice verification API
- Email notifications

**От M004 (Bank Integration):**
- BankStatement, BankTransaction модели
- UnresolvedTransaction CRUD API
- Analytics endpoints (/api/analytics/dashboard, /api/analytics/payment-dynamics)

### Выходные границы (контракт для следующих milestone)

**К M006 (Business Logic Polish):**
- Frontend компоненты готовы для Kanban бизнес-логики
- RBAC middleware можно расширить для finer-grained permissions
- Аналитика готова для матрицы готовности проекта

### Интеграционные границы (внутри M005)

**S01 → S02/S03/S04:**
- API клиент с TypeScript типами используется всеми последующими слайсами
- Проксирование Next.js → FastAPI настроено один раз в S01

**S02 → S04:**
- DnD изменения статуса проходят через RBAC middleware

**S01/S03 → S05:**
- Production build использует реальные API endpoints
- Docker compose конфиг включает все сервисы
