---
estimated_steps: 4
estimated_files: 3
skills_used: []
---

# T01: Setup PostgreSQL connection и Alembic

1. Установить зависимости (psycopg2, alembic, sqlalchemy)
2. Создать .env с DATABASE_URL
3. Инициализировать Alembic (alembic init)
4. Настроить alembic.ini и env.py для PostgreSQL

## Inputs

- `.env с DATABASE_URL`

## Expected Output

- `alembic.ini настроен`
- `env.py подключается к БД`
- `alembic/versions/ директория создана`

## Verification

alembic current - показывает revision; alembic history работает
