# M001: Foundation: Database Schema and Core API

**Vision:** Создать фундамент системы: схему БД PostgreSQL, базовый FastAPI backend с основными сущностями (Project, ProjectItem, Supplier, StockItem) и REST API для CRUD операций. Это основа для всех последующих модулей.

## Success Criteria

- PostgreSQL схема создана и применена через Alembic миграции
- FastAPI сервер запускается и отвечает на health check
- CRUD API работает для Project, ProjectItem, Supplier, StockItem
- Базовые тесты покрывают модели и эндпоинты
- Документация API доступна через /docs (Swagger UI)

## Slices

- [x] **S01: S01** `risk:high` `depends:[]`
  > After this: После этого: `alembic revision head` применяет схему к пустой БД; все таблицы созданы с правильными типами, индексами и foreign keys

- [ ] **S02: S02** `risk:high` `depends:[]`
  > After this: После этого: Python модели мапятся 1:1 к таблицам; Pydantic schemas валидируют вход/выход; можно создать ORM объект и сохранить в БД

- [ ] **S03: FastAPI CRUD Endpoints** `risk:medium` `depends:[S02]`
  > After this: После этого: POST /projects создает проект; GET /projects/{id} возвращает с items; DELETE работает; Swagger UI показывает все эндпоинты

- [ ] **S04: Docker + Health Checks** `risk:low` `depends:[S03]`
  > After this: После этого: docker-compose up запускает всё; GET /health returns 200; localhost:8000/docs открывается

## Boundary Map

### S01 → S02
Produces:
- PostgreSQL таблицы: project, project_item, supplier, stock_item, purchase_order, invoice, payment, unresolved_transaction, production_task
- Foreign keys и constraints
- Alembic конфигурация для будущих миграций

Consumes:
- nothing (first slice)

### S02 → S03
Produces:
- SQLAlchemy ORM модели (Python классы с маппингом)
- Pydantic schemas (Create, Update, Response схемы)
- Relationships между моделями

Consumes:
- PostgreSQL схемы из S01

### S03 → S04
Produces:
- FastAPI приложение с CRUD endpoints
- Dependency injection для DB session
- Swagger UI документация

Consumes:
- SQLAlchemy модели из S02
- PostgreSQL таблицы из S01
