"""
Pytest configuration and shared fixtures for backend tests.

Fixtures:
- db_session: SQLAlchemy session for in-memory SQLite database
- test_engine: SQLAlchemy engine for tests
- test_client: FastAPI TestClient for API endpoint tests
"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Import Base and models
try:
    from backend.models import Base
    from backend.database import get_db
except ImportError:
    from models import Base
    from database import get_db


# =============================================================================
# Database Fixtures
# =============================================================================

@pytest.fixture(scope="function")
def test_engine():
    """Create an in-memory SQLite database for testing.

    Uses StaticPool to maintain the same connection across the session,
    which is required for foreign key constraints in SQLite.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    return engine


@pytest.fixture(scope="function")
def db_session(test_engine):
    """Create a database session with all tables created.

    This fixture:
    1. Creates all tables in the in-memory database
    2. Yields a session for use in tests
    3. Rolls back and closes the session after tests

    Usage:
        def test_my_model(db_session):
            project = Project(name="Test", client="Client")
            db_session.add(project)
            db_session.commit()
            assert project.id is not None
    """
    # Create all tables
    Base.metadata.create_all(test_engine)

    # Create session
    TestSession = sessionmaker(bind=test_engine)
    session = TestSession()

    try:
        yield session
    finally:
        session.rollback()
        session.close()
        # Drop all tables for clean slate in next test
        Base.metadata.drop_all(test_engine)


@pytest.fixture(scope="function")
def db_session_with_fk(test_engine):
    """Create a database session with foreign key constraints enabled.

    SQLite requires explicit FK constraint enabling.
    """
    # Enable FK constraints
    with test_engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.commit()

    # Create all tables
    Base.metadata.create_all(test_engine)

    # Create session
    TestSession = sessionmaker(bind=test_engine)
    session = TestSession()

    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(test_engine)


@pytest.fixture(scope="function")
def test_client(test_engine):
    """Create a FastAPI TestClient for API testing with isolated DB.

    This fixture uses the same test engine to ensure the FastAPI app
    uses the same database as the tests.
    """
    from fastapi.testclient import TestClient

    # Import main app to ensure all routes are registered
    try:
        from backend.main import app
    except ImportError:
        from main import app

    # Use the same engine (tables already created)
    TestSessionLocal = sessionmaker(bind=test_engine)

    # Create tables in case they weren't created yet
    Base.metadata.create_all(test_engine)

    # Override the get_db dependency to use test database
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    yield client

    # Clean up
    app.dependency_overrides.clear()
