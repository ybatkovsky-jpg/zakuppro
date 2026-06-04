"""
Tests for GET /api/projects/readiness endpoint.

Covers:
- Readiness computation: green, yellow, red scenarios
- Breakdown accuracy
- RBAC: 401 (no token), 403 (warehouse), 200 (owner, manager)
- Ownership filter: manager sees only own projects
- Edge cases: empty DB, empty project
"""
import pytest
from sqlalchemy.orm import Session

from backend.models import (
    Project, ProjectItem, User, Role,
)
from backend.auth import create_access_token


# =============================================================================
# Helpers
# =============================================================================

def _make_user(db: Session, role: Role = Role.OWNER, username: str = "testuser") -> User:
    u = User(
        username=username, email=f"{username}@test.com",
        hashed_password="hashed", role=role,
    )
    db.add(u)
    db.flush()
    return u


def _make_project(db: Session, name: str = "Test Project", status: str = "Закупки", owner_id: int = 1) -> Project:
    p = Project(name=name, client="Test Client", status=status, owner_id=owner_id)
    db.add(p)
    db.flush()
    return p


def _make_item(
    db: Session, project_id: int, name: str = "Item",
    sku: str = "SKU-001", qty: int = 5, status: str = "К закупке",
) -> ProjectItem:
    pi = ProjectItem(
        project_id=project_id, name=name, sku=sku, qty=qty, status=status,
    )
    db.add(pi)
    db.flush()
    return pi


# =============================================================================
# Test Helpers — FastAPI client with override
# =============================================================================

@pytest.fixture
def client_and_db():
    """Create TestClient with shared in-memory SQLite DB session."""
    from backend.main import app
    from backend.database import get_db, Base as DBBase
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    DBBase.metadata.create_all(engine)
    TestSessionLocal = sessionmaker(bind=engine)
    session = TestSessionLocal()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield client, session

    app.dependency_overrides.clear()
    session.close()
    DBBase.metadata.drop_all(engine)


# =============================================================================
# Readiness Computation Tests
# =============================================================================

class TestReadinessComputation:
    """Tests for readiness computation logic via the API."""

    def test_green_all_ready(self, client_and_db):
        """All items in PRODUCTION_READY_STATUSES → green."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id)
        _make_item(session, p.id, status="На складе")
        _make_item(session, p.id, status="Оплачено")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["readiness"] == "green"
        assert data[0]["ready_count"] == 2
        assert data[0]["total_count"] == 2

    def test_green_empty_project(self, client_and_db):
        """Empty project (no items) → green."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        _make_project(session, owner_id=u.id)
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["readiness"] == "green"
        assert data[0]["total_count"] == 0
        assert data[0]["ready_count"] == 0
        assert data[0]["breakdown"] == {}

    def test_yellow_in_transit(self, client_and_db):
        """Items in Запрошено/Счет получен (no К закупке) → yellow."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id)
        _make_item(session, p.id, status="Запрошено")
        _make_item(session, p.id, status="Счет получен")
        _make_item(session, p.id, status="На складе")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["readiness"] == "yellow"
        assert data[0]["ready_count"] == 1
        assert data[0]["total_count"] == 3

    def test_red_has_k_zakupke(self, client_and_db):
        """Any К закупке item → red."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id)
        _make_item(session, p.id, status="На складе")
        _make_item(session, p.id, status="Оплачено")
        _make_item(session, p.id, status="К закупке")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["readiness"] == "red"
        assert data[0]["ready_count"] == 2
        assert data[0]["total_count"] == 3

    def test_mixed_status_breakdown_accuracy(self, client_and_db):
        """Breakdown dict matches actual item counts per status."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id)
        _make_item(session, p.id, name="A", status="К закупке")
        _make_item(session, p.id, name="B", status="Запрошено")
        _make_item(session, p.id, name="C", status="Счет получен")
        _make_item(session, p.id, name="D", status="Оплачено")
        _make_item(session, p.id, name="E", status="На складе")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        breakdown = resp.json()[0]["breakdown"]
        assert breakdown["К закупке"] == 1
        assert breakdown["Запрошено"] == 1
        assert breakdown["Счет получен"] == 1
        assert breakdown["Оплачено"] == 1
        assert breakdown["На складе"] == 1

    def test_single_item_red(self, client_and_db):
        """Single item with К закупке → red."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id)
        _make_item(session, p.id, status="К закупке")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["readiness"] == "red"
        assert data[0]["ready_count"] == 0
        assert data[0]["total_count"] == 1


# =============================================================================
# RBAC Tests
# =============================================================================

class TestReadinessRBAC:
    """Tests for RBAC enforcement on the readiness endpoint."""

    def test_401_no_token(self, client_and_db):
        """No token → 401."""
        client, session = client_and_db
        resp = client.get("/api/projects/readiness")
        assert resp.status_code == 401

    def test_403_warehouse(self, client_and_db):
        """Warehouse role → 403."""
        client, session = client_and_db
        u = _make_user(session, role=Role.WAREHOUSE, username="wh")
        token = create_access_token({"user_id": u.id, "role": u.role.value})
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_200_owner(self, client_and_db):
        """Owner role → 200 with results."""
        client, session = client_and_db
        u = _make_user(session, role=Role.OWNER)
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id)
        _make_item(session, p.id, status="На складе")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_200_manager(self, client_and_db):
        """Manager role → 200 with results."""
        client, session = client_and_db
        u = _make_user(session, role=Role.MANAGER, username="mgr")
        token = create_access_token({"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id)
        _make_item(session, p.id, status="На складе")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_ownership_filter_manager_sees_only_own(self, client_and_db):
        """Manager only sees projects they own in readiness results."""
        client, session = client_and_db
        mgr = _make_user(session, role=Role.MANAGER, username="mgr1")
        other = _make_user(session, role=Role.MANAGER, username="mgr2")
        token = create_access_token({"user_id": mgr.id, "role": mgr.role.value})

        pmgr = _make_project(session, name="Mgr Project", owner_id=mgr.id)
        _make_item(session, pmgr.id, status="На складе")
        pother = _make_project(session, name="Other Project", owner_id=other.id)
        _make_item(session, pother.id, status="К закупке")
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["project_id"] == pmgr.id
        assert data[0]["project_name"] == "Mgr Project"

    def test_nonexistent_project_handling(self, client_and_db):
        """Empty DB returns 200 with empty list, no errors."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token({"user_id": u.id, "role": u.role.value})
        session.commit()

        resp = client.get(
            "/api/projects/readiness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []
