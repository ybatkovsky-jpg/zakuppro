"""
Tests for transition_service.py — Kanban guardrail validation.

Covers:
- can_transition_to unit tests: blocks, allows, edge cases
- Integration: 422 from API when guard blocks, 200 when guard passes
- Non-production transitions are never blocked
"""
import pytest
from sqlalchemy.orm import Session

from backend.models import (
    Project, ProjectItem, StockItem, User, Role,
)
from backend.services.transition_service import can_transition_to
from backend.auth import create_access_token


# =============================================================================
# Helpers
# =============================================================================

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


def _make_user(db: Session, role: Role = Role.OWNER) -> User:
    u = User(
        username="testuser", email="test@test.com",
        hashed_password="hashed", role=role,
    )
    db.add(u)
    db.flush()
    return u


# =============================================================================
# TestCanTransitionTo — unit tests for the guard function
# =============================================================================

class TestCanTransitionTo:
    """Unit tests for can_transition_to()."""

    # -- Blocking scenarios --

    def test_blocks_when_item_is_k_zakupke(self, db_session):
        """Transition to production blocked when an item is К закупке."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, status="К закупке")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert not ok
        assert "К закупке" in reason

    def test_blocks_when_item_is_zaprosheno(self, db_session):
        """Transition to production blocked when an item is Запрошено."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, status="Запрошено")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert not ok
        assert "Запрошено" in reason

    def test_blocks_when_item_is_schet_poluchen(self, db_session):
        """Transition to production blocked when an item is Счет получен."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, status="Счет получен")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert not ok
        assert "Счет получен" in reason

    def test_blocks_mixed_statuses(self, db_session):
        """Transition blocked when some items are ready, some not."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, name="Ready", status="На складе")
        _make_item(db_session, p.id, name="NotReady", status="К закупке")
        _make_item(db_session, p.id, name="AlsoReady", status="Оплачено")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert not ok
        assert "К закупке" in reason

    def test_blocks_all_non_ready(self, db_session):
        """Transition blocked when all items are non-ready."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, status="К закупке")
        _make_item(db_session, p.id, status="Запрошено")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert not ok
        assert "К закупке" in reason
        assert "Запрошено" in reason

    # -- Allowing scenarios --

    def test_allows_all_na_sklade(self, db_session):
        """Transition allowed when all items are На складе."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, status="На складе")
        _make_item(db_session, p.id, status="На складе")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert ok
        assert reason == ""

    def test_allows_all_oplacheno(self, db_session):
        """Transition allowed when all items are Оплачено."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, status="Оплачено")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert ok
        assert reason == ""

    def test_allows_mixed_ready(self, db_session):
        """Transition allowed when items are mixed На складе/Оплачено."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, name="A", status="На складе")
        _make_item(db_session, p.id, name="B", status="Оплачено")
        _make_item(db_session, p.id, name="C", status="На складе")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert ok
        assert reason == ""

    # -- Edge cases --

    def test_allows_empty_project(self, db_session):
        """Transition allowed when project has no items."""
        p = _make_project(db_session)

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert ok
        assert reason == ""

    def test_allows_non_production_target(self, db_session):
        """Transition to non-production status always allowed."""
        p = _make_project(db_session)
        _make_item(db_session, p.id, status="К закупке")

        ok, reason = can_transition_to(p, "Проектирование", db_session)
        assert ok
        assert reason == ""

        ok, reason = can_transition_to(p, "Закупки", db_session)
        assert ok
        assert reason == ""

    def test_allows_production_with_no_status_change(self, db_session):
        """Guard doesn't block same-status (no-op) - handled by caller."""
        p = _make_project(db_session, status="В производстве")
        _make_item(db_session, p.id, status="На складе")

        ok, reason = can_transition_to(p, "В производстве", db_session)
        assert ok


# =============================================================================
# TestTransitionGuardAPI — integration via FastAPI test client
# =============================================================================

class TestTransitionGuardAPI:
    """Integration tests for the 422 guard in the update_project endpoint.

    Uses a client_and_db fixture that shares one session between test data
    creation and the FastAPI dependency override, so the API sees the data.
    """

    @pytest.fixture
    def client_and_db(self):
        """Create TestClient with shared test DB session."""
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

    def test_422_when_transition_to_production_blocked(self, client_and_db):
        """API returns 422 when ProjectItems are not ready for production."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token(data={"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id, status="Закупки")
        _make_item(session, p.id, status="К закупке")
        session.commit()

        resp = client.put(
            f"/api/projects/{p.id}",
            json={"status": "В производстве"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert "К закупке" in detail

    def test_422_with_multiple_non_ready(self, client_and_db):
        """API returns 422 with breakdown of multiple non-ready statuses."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token(data={"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id, status="Закупки")
        _make_item(session, p.id, name="A", status="К закупке")
        _make_item(session, p.id, name="B", status="Запрошено")
        _make_item(session, p.id, name="C", status="На складе")
        session.commit()

        resp = client.put(
            f"/api/projects/{p.id}",
            json={"status": "В производстве"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert "К закупке" in detail
        assert "Запрошено" in detail

    def test_200_when_all_items_ready(self, client_and_db):
        """API allows transition when all items are На складе."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token(data={"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id, status="Закупки")
        _make_item(session, p.id, status="На складе")
        _make_item(session, p.id, status="Оплачено")
        session.commit()

        resp = client.put(
            f"/api/projects/{p.id}",
            json={"status": "В производстве"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_200_allows_non_production_transition(self, client_and_db):
        """API allows transition to non-production status regardless of items."""
        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token(data={"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id, status="Проектирование")
        _make_item(session, p.id, status="К закупке")
        session.commit()

        resp = client.put(
            f"/api/projects/{p.id}",
            json={"status": "Закупки"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "Закупки"

    def test_history_recorded_on_valid_transition(self, client_and_db):
        """ProjectStatusHistory is created when guard passes."""
        from backend.models import ProjectStatusHistory

        client, session = client_and_db
        u = _make_user(session)
        token = create_access_token(data={"user_id": u.id, "role": u.role.value})

        p = _make_project(session, owner_id=u.id, status="Закупки")
        _make_item(session, p.id, status="На складе")
        session.commit()

        resp = client.put(
            f"/api/projects/{p.id}",
            json={"status": "В производстве"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

        history = session.query(ProjectStatusHistory).filter(
            ProjectStatusHistory.project_id == p.id
        ).all()
        assert len(history) >= 1
        assert history[-1].from_status == "Закупки"
        assert history[-1].to_status == "В производстве"
