# Backend - FastAPI + PostgreSQL + Alembic

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure `.env` file in the project root:
```
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/zakuppro
```

3. Run Alembic commands:
```bash
# Check current revision (requires running PostgreSQL)
alembic current

# View migration history
alembic history

# Create a new migration
alembic revision -m "description"

# Apply migrations to database
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## Database Connection

The database connection is configured in `database.py` and `alembic/env.py`.

## Project Structure

```
backend/
├── alembic/
│   ├── versions/        # Migration files
│   ├── env.py           # Alembic environment configuration
│   └── script.py.mako   # Migration template
├── alembic.ini          # Alembic configuration
├── database.py          # Database connection and session management
└── requirements.txt     # Python dependencies
```
