"""
Pytest configuration and shared fixtures for backend tests.

Fixtures:
- test_engine: SQLAlchemy engine for in-memory SQLite database
- db_session: SQLAlchemy session for in-memory SQLite database
- test_client: FastAPI TestClient with DB isolation (no auth)
- auth_client: FastAPI TestClient with DB isolation AND authenticated owner user
"""
import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Import Base and models
try:
    from backend.models import Base, User, Role
    from backend.database import get_db
except ImportError:
    from models import Base, User, Role
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


# =============================================================================
# HTTP Client Fixtures
# =============================================================================

@pytest.fixture(scope="function")
def test_client(test_engine):
    """Create a FastAPI TestClient for API testing with isolated DB.

    This fixture uses the same test engine to ensure the FastAPI app
    uses the same database as the tests.

    NOTE: This client does NOT provide authentication. For endpoints
    that require RBAC, use `auth_client` instead.
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


@pytest.fixture(scope="function")
def auth_client(test_engine):
    """Create a FastAPI TestClient with authenticated owner user.

    This fixture:
    1. Creates all tables in the test database
    2. Creates an owner user in the database
    3. Overrides get_db, get_current_user, and get_current_active_user
    4. Provides a TestClient that sends authenticated requests as owner

    The client includes a valid Authorization header with a JWT token.

    Usage:
        def test_create_project(auth_client):
            response = auth_client.post("/api/projects/", json={...})
            assert response.status_code == 201  # not 401
    """
    from fastapi.testclient import TestClient

    try:
        from backend.main import app
        from backend.auth import get_current_user, get_current_active_user, create_access_token
    except ImportError:
        from main import app
        from auth import get_current_user, get_current_active_user, create_access_token

    # Create tables
    Base.metadata.create_all(test_engine)
    TestSessionLocal = sessionmaker(bind=test_engine)

    # Create a test owner user in the database
    session = TestSessionLocal()
    from passlib.hash import sha256_crypt
    test_user = User(
        username="test_owner",
        email="test_owner@example.com",
        hashed_password=sha256_crypt.hash("testpassword"),
        role=Role.OWNER,
    )
    session.add(test_user)
    session.commit()
    test_user_id = test_user.id
    session.close()

    # Override get_db
    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    # Override get_current_user to return our test user (no params — must be plain callable)
    def override_get_current_user():
        db = TestSessionLocal()
        try:
            return db.query(User).filter(User.id == test_user_id).first()
        finally:
            db.close()

    # Override get_current_active_user to return our test user
    def override_get_current_active_user():
        db = TestSessionLocal()
        try:
            return db.query(User).filter(User.id == test_user_id).first()
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user

    # Create a valid JWT token for the test user
    access_token = create_access_token(
        data={"user_id": test_user_id, "role": Role.OWNER.value}
    )

    client = TestClient(app)
    # Set default authorization header for all requests
    client.headers["Authorization"] = f"Bearer {access_token}"

    yield client

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def manager_client(test_engine):
    """Create a FastAPI TestClient with authenticated manager user.

    Similar to auth_client but with manager role.
    """
    from fastapi.testclient import TestClient

    try:
        from backend.main import app
        from backend.auth import get_current_user, get_current_active_user, create_access_token
    except ImportError:
        from main import app
        from auth import get_current_user, get_current_active_user, create_access_token

    # Create tables
    Base.metadata.create_all(test_engine)
    TestSessionLocal = sessionmaker(bind=test_engine)

    # Create a test manager user
    session = TestSessionLocal()
    from passlib.hash import sha256_crypt
    test_user = User(
        username="test_manager",
        email="test_manager@example.com",
        hashed_password=sha256_crypt.hash("testpassword"),
        role=Role.MANAGER,
    )
    session.add(test_user)
    session.commit()
    test_user_id = test_user.id
    session.close()

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user():
        db = TestSessionLocal()
        try:
            return db.query(User).filter(User.id == test_user_id).first()
        finally:
            db.close()

    def override_get_current_active_user():
        db = TestSessionLocal()
        try:
            return db.query(User).filter(User.id == test_user_id).first()
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_active_user] = override_get_current_active_user

    access_token = create_access_token(
        data={"user_id": test_user_id, "role": Role.MANAGER.value}
    )

    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {access_token}"

    yield client

    app.dependency_overrides.clear()
