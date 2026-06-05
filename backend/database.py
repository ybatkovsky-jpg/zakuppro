"""
Database connection and session management for the application.

Uses SQLAlchemy 2.0 declarative style (DeclarativeBase) and
configurable SQL echo via the DB_ECHO environment variable.

Supports both PostgreSQL (production) and SQLite (testing) backends.
SQLite-compatible engine parameters are selected automatically based on
the DATABASE_URL scheme.
"""

import os
from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Load environment variables
load_dotenv()

# ---------------------------------------------------------------------------
# Configuration (all from environment, with sensible defaults)
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/zakuppro",
)

# SQL echo: logs all SQL statements.  Default OFF in production.
# Set DB_ECHO=true to enable (useful for debugging).
DB_ECHO = os.getenv("DB_ECHO", "false").lower() in ("true", "1", "yes")

# ---------------------------------------------------------------------------
# Engine — build kwargs depending on backend (PostgreSQL vs SQLite)
# ---------------------------------------------------------------------------

_is_sqlite = DATABASE_URL.startswith("sqlite")

_engine_kwargs: dict = {
    "echo": DB_ECHO,
}

if _is_sqlite:
    # SQLite does not support pool_size / max_overflow / pool_pre_ping
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Pool size and max overflow for production workloads (PostgreSQL)
    DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
    DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))

    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = DB_POOL_SIZE
    _engine_kwargs["max_overflow"] = DB_MAX_OVERFLOW

engine = create_engine(DATABASE_URL, **_engine_kwargs)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Base class — SQLAlchemy 2.0 style (replaces deprecated declarative_base())
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """Declarative base class for all ORM models (SQLAlchemy 2.0 style)."""
    pass


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db():
    """
    Dependency function to get database session.

    Usage in FastAPI:
        db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
