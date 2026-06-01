"""
Shared pytest fixtures for API and model tests.

Uses SQLite in-memory database for fast isolated tests.

IMPORTANT: Import order matters! Import backend.main first to ensure
models are registered with Base before we call create_all.
"""
import pytest
import tempfile
from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Import main first to ensure all models are loaded and registered
from backend.main import app  # noqa: F401 - ensures models are loaded

from backend.database import Base
from backend.models import (
    Project, ProjectItem, Supplier, StockItem,
    PurchaseOrder, Invoice, Payment, UnresolvedTransaction,
    ProductionTask
)


@pytest.fixture(scope="function")
def test_engine():
    """Create a file-based SQLite engine for testing with a temp file."""
    # Use a temp file that gets cleaned up automatically
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    temp_path = temp_file.name
    temp_file.close()

    TEST_DATABASE_URL = f"sqlite:///{temp_path}"
    engine_obj = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine_obj)

    yield engine_obj

    # Clean up
    engine_obj.dispose()
    try:
        Path(temp_path).unlink(missing_ok=True)
    except Exception:
        pass  # Windows file locks may prevent deletion


@pytest.fixture(scope="function")
def db_session(test_engine):
    """Create a database session for testing."""
    SessionLocal = sessionmaker(bind=test_engine)
    session = SessionLocal()
    try:
        yield session
        session.rollback()
    finally:
        session.close()


@pytest.fixture(scope="function")
def test_client(test_engine):
    """Create a FastAPI TestClient for API testing with isolated DB.

    This fixture uses the same test engine to ensure the FastAPI app
    uses the same database as the tests.
    """
    from fastapi.testclient import TestClient

    # Use the same engine (tables already created)
    TestSessionLocal = sessionmaker(bind=test_engine)

    # Override the get_db dependency to use test database
    from backend.database import get_db

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
    # test_engine is disposed by its own fixture


@pytest.fixture
def sample_project(db_session):
    """Create a sample project for testing."""
    project = Project(
        name="Test Project",
        client="Test Client LLC",
        status="Проектирование",
        total_cost=100000.00
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


@pytest.fixture
def sample_project_with_items(db_session):
    """Create a sample project with items for testing."""
    project = Project(
        name="Project with Items",
        client="Client ABC",
        status="В работе",
        total_cost=50000.00
    )
    db_session.add(project)
    db_session.flush()

    items = [
        ProjectItem(
            project_id=project.id,
            name="Steel Beam",
            sku="SB-001",
            qty=10,
            status="К закупке"
        ),
        ProjectItem(
            project_id=project.id,
            name="Concrete Mix",
            sku="CM-002",
            qty=5,
            status="Заказано"
        ),
        ProjectItem(
            project_id=project.id,
            name="Wood Panel",
            sku="WP-003",
            qty=20,
            status="К закупке"
        )
    ]
    db_session.add_all(items)
    db_session.commit()
    db_session.refresh(project)
    return project


@pytest.fixture
def sample_supplier(db_session):
    """Create a sample supplier for testing."""
    supplier = Supplier(
        name="BuildCorp Inc.",
        email="contact@buildcorp.example.com",
        requisites="INN: 1234567890, KPP: 123456789"
    )
    db_session.add(supplier)
    db_session.commit()
    db_session.refresh(supplier)
    return supplier


@pytest.fixture
def sample_stock_item(db_session):
    """Create a sample stock item for testing."""
    stock = StockItem(
        name="Standard Bolt M10",
        sku="BOLT-M10-STD",
        qty_total=1000,
        qty_reserved=200,
        qty_available=800
    )
    db_session.add(stock)
    db_session.commit()
    db_session.refresh(stock)
    return stock
