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

## Authentication

The API uses JWT-based authentication with role-based access control (RBAC).

### Login Endpoint

**POST** `/api/auth/login`

Request body:
```json
{
  "username": "owner",
  "password": "owner123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "role": "owner"
}
```

### Test Credentials

For testing purposes, the following default users are available (seeds are created in migrations):

| Username | Password  | Role      | Description |
|----------|-----------|-----------|-------------|
| owner    | owner123  | owner     | Full access to all resources |
| manager  | manager123 | manager  | Access only to own projects |
| warehouse| warehouse123 | warehouse | Access only to warehouse operations |

### Using the Token

Include the JWT token in the Authorization header for protected endpoints:

```
Authorization: Bearer <access_token>
```

### Environment Variables

Configure JWT settings in `.env`:

```
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
```
