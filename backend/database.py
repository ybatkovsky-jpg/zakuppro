"""
Database connection and session management for the application.

Uses SQLAlchemy 2.0 declarative style (DeclarativeBase) and
configurable SQL echo via the DB_ECHO environment variable.
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

# Pool size and max overflow for production workloads
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # Verify connections before using them
    echo=DB_ECHO,         # Configurable SQL logging (was hardcoded True)
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
)

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
