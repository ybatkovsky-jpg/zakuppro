"""
FastAPI admin DLQ (FailedTask) endpoint integration tests.

Tests verify:
- GET  /api/admin/failed-tasks/          — paginated list, empty, with records, filter, pagination
- GET  /api/admin/failed-tasks/{id}      — detail 200, detail 404
- POST /api/admin/failed-tasks/{id}/retry — retry success (mocked Celery), unknown task → 400,
                                            malformed context → 422
- Role enforcement: owner=200, manager=403, warehouse=403, unauthenticated=401
"""
import json
from unittest.mock import patch, MagicMock
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from passlib.hash import sha256_crypt
from sqlalchemy.orm import sessionmaker

from backend.auth import create_access_token
from backend.database import get_db
from backend.main import app
from backend.models import Base, FailedTask, User, Role


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def admin_fixture(test_engine):
    """
    Set up test database with users and override get_db.

    Yields (client, owner_headers, manager_headers, warehouse_headers, db_session).
    The db_session is kept alive so the in-memory SQLite data is not lost.
    """
    TestSession = sessionmaker(bind=test_engine)

    # Create tables and test users
    Base.metadata.create_all(test_engine)
    session = TestSession()

    owner = User(
        username="admin_owner",
        email="admin_owner@example.com",
        hashed_password=sha256_crypt.hash("test"),
        role=Role.OWNER,
    )
    manager = User(
        username="admin_manager",
        email="admin_manager@example.com",
        hashed_password=sha256_crypt.hash("test"),
        role=Role.MANAGER,
    )
    warehouse = User(
        username="admin_warehouse",
        email="admin_warehouse@example.com",
        hashed_password=sha256_crypt.hash("test"),
        role=Role.WAREHOUSE,
    )
    session.add_all([owner, manager, warehouse])
    session.commit()

    # Create JWT tokens
    owner_token = create_access_token({"user_id": owner.id, "role": "owner"})
    manager_token = create_access_token({"user_id": manager.id, "role": "manager"})
    warehouse_token = create_access_token({"user_id": warehouse.id, "role": "warehouse"})

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    manager_headers = {"Authorization": f"Bearer {manager_token}"}
    warehouse_headers = {"Authorization": f"Bearer {warehouse_token}"}

    # Override get_db to use test database
    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client, owner_headers, manager_headers, warehouse_headers, session

    # Cleanup
    app.dependency_overrides.clear()
    session.close()


# =============================================================================
# Helper — seed FailedTask records
# =============================================================================

def create_failed_task(db_session, **overrides) -> FailedTask:
    """Create a FailedTask record and return it."""
    defaults = {
        "task_id": "celery-uuid-1234",
        "task_name": "tasks.test_retry",
        "error_message": "ValueError: something broke",
        "error_type": "ValueError",
        "file_path": None,
        "chat_id": None,
        "context": None,
    }
    defaults.update(overrides)
    ft = FailedTask(**defaults)
    db_session.add(ft)
    db_session.commit()
    db_session.refresh(ft)
    return ft


# =============================================================================
# Test: List — empty
# =============================================================================

class TestListEmpty:
    """GET /api/admin/failed-tasks/ when no records exist."""

    def test_list_empty(self, admin_fixture):
        client, owner_headers, *_ = admin_fixture
        response = client.get("/api/admin/failed-tasks/", headers=owner_headers)
        assert response.status_code == 200
        data = response.json()
        assert data == {"items": [], "total": 0, "skip": 0, "limit": 100}


# =============================================================================
# Test: List — with records
# =============================================================================

class TestListWithRecords:
    """GET /api/admin/failed-tasks/ with seeded records."""

    def test_list_with_records(self, admin_fixture):
        client, owner_headers, *_, session = admin_fixture
        create_failed_task(session, task_id="uuid-alpha", task_name="tasks.alpha")
        create_failed_task(session, task_id="uuid-beta", task_name="tasks.beta")

        response = client.get("/api/admin/failed-tasks/", headers=owner_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2
        returned_names = {item["task_name"] for item in data["items"]}
        assert returned_names == {"tasks.alpha", "tasks.beta"}

    def test_list_filter_by_task_name(self, admin_fixture):
        client, owner_headers, *_, session = admin_fixture
        create_failed_task(session, task_id="uuid-1", task_name="tasks.alpha")
        create_failed_task(session, task_id="uuid-2", task_name="tasks.beta")
        create_failed_task(session, task_id="uuid-3", task_name="tasks.alpha")

        response = client.get(
            "/api/admin/failed-tasks/",
            headers=owner_headers,
            params={"task_name": "tasks.alpha"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert all(item["task_name"] == "tasks.alpha" for item in data["items"])

    def test_list_pagination_skip_limit(self, admin_fixture):
        client, owner_headers, *_, session = admin_fixture
        for i in range(5):
            create_failed_task(session, task_id=f"uuid-{i}", task_name=f"tasks.task_{i}")

        # Skip 2, limit 2
        response = client.get(
            "/api/admin/failed-tasks/",
            headers=owner_headers,
            params={"skip": 2, "limit": 2},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["skip"] == 2
        assert data["limit"] == 2


# =============================================================================
# Test: Detail
# =============================================================================

class TestDetail:
    """GET /api/admin/failed-tasks/{id}."""

    def test_detail_200(self, admin_fixture):
        client, owner_headers, *_, session = admin_fixture
        ft = create_failed_task(
            session,
            task_id="uuid-detail",
            task_name="tasks.detail_test",
            error_message="Some error",
            error_type="RuntimeError",
            context='{"key": "value"}',
        )

        response = client.get(f"/api/admin/failed-tasks/{ft.id}", headers=owner_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == ft.id
        assert data["task_id"] == "uuid-detail"
        assert data["task_name"] == "tasks.detail_test"
        assert data["error_message"] == "Some error"
        assert data["error_type"] == "RuntimeError"
        assert data["context"] == '{"key": "value"}'
        assert "created_at" in data

    def test_detail_404(self, admin_fixture):
        client, owner_headers, *_ = admin_fixture
        response = client.get("/api/admin/failed-tasks/99999", headers=owner_headers)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


# =============================================================================
# Test: Retry
# =============================================================================

class TestRetry:
    """POST /api/admin/failed-tasks/{id}/retry."""

    def test_retry_success(self, admin_fixture):
        """Retry dispatches to Celery and deletes the FailedTask record."""
        client, owner_headers, *_, session = admin_fixture
        ft = create_failed_task(
            session,
            task_id="uuid-retry",
            task_name="tasks.test_retry",
            context='{"file_path": "/tmp/test.xlsx", "chat_id": 123}',
        )
        ft_id = ft.id

        mock_task = MagicMock()
        # Patch celery_app.app.tasks to include our known task
        with patch.dict("backend.celery_app.app.tasks", {"tasks.test_retry": mock_task}, clear=False):
            response = client.post(
                f"/api/admin/failed-tasks/{ft_id}/retry",
                headers=owner_headers,
            )

        assert response.status_code == 200
        assert response.json() == {"status": "retried"}

        # Verify Celery was called with the right kwargs
        mock_task.apply_async.assert_called_once_with(
            kwargs={"file_path": "/tmp/test.xlsx", "chat_id": 123}
        )

        # Verify FailedTask was deleted
        session.expire_all()
        deleted = session.query(FailedTask).filter(FailedTask.id == ft_id).first()
        assert deleted is None

    def test_retry_empty_context(self, admin_fixture):
        """Retry works with None/empty context."""
        client, owner_headers, *_, session = admin_fixture
        ft = create_failed_task(
            session,
            task_id="uuid-empty-ctx",
            task_name="tasks.test_empty",
            context=None,
        )

        mock_task = MagicMock()
        with patch.dict("backend.celery_app.app.tasks", {"tasks.test_empty": mock_task}, clear=False):
            response = client.post(
                f"/api/admin/failed-tasks/{ft.id}/retry",
                headers=owner_headers,
            )

        assert response.status_code == 200
        mock_task.apply_async.assert_called_once_with(kwargs={})

    def test_retry_unknown_task_name(self, admin_fixture):
        """Returns 400 when task_name is not registered in Celery."""
        client, owner_headers, *_, session = admin_fixture
        ft = create_failed_task(
            session,
            task_id="uuid-unknown",
            task_name="tasks.nonexistent",
        )

        response = client.post(
            f"/api/admin/failed-tasks/{ft.id}/retry",
            headers=owner_headers,
        )
        assert response.status_code == 400
        assert "not registered" in response.json()["detail"].lower()

    def test_retry_malformed_context(self, admin_fixture):
        """Returns 422 when context is not valid JSON."""
        client, owner_headers, *_, session = admin_fixture
        ft = create_failed_task(
            session,
            task_id="uuid-bad-json",
            task_name="tasks.test_retry",
            context="this is not json",
        )

        mock_task = MagicMock()
        with patch.dict("backend.celery_app.app.tasks", {"tasks.test_retry": mock_task}, clear=False):
            response = client.post(
                f"/api/admin/failed-tasks/{ft.id}/retry",
                headers=owner_headers,
            )

        assert response.status_code == 422
        assert "malformed" in response.json()["detail"].lower()

    def test_retry_404(self, admin_fixture):
        """Returns 404 when FailedTask does not exist."""
        client, owner_headers, *_ = admin_fixture
        response = client.post(
            "/api/admin/failed-tasks/99999/retry",
            headers=owner_headers,
        )
        assert response.status_code == 404


# =============================================================================
# Test: Role-Based Access Control (RBAC)
# =============================================================================

class TestRBAC:
    """Role enforcement for all endpoints."""

    def _seed_one(self, session) -> int:
        ft = create_failed_task(session, task_id="uuid-rbac", task_name="tasks.rbac_test")
        return ft.id

    # -- Owner (should succeed) --

    def test_owner_list(self, admin_fixture):
        client, owner_headers, *_, session = admin_fixture
        self._seed_one(session)
        response = client.get("/api/admin/failed-tasks/", headers=owner_headers)
        assert response.status_code == 200

    def test_owner_detail(self, admin_fixture):
        client, owner_headers, *_, session = admin_fixture
        ft_id = self._seed_one(session)
        response = client.get(f"/api/admin/failed-tasks/{ft_id}", headers=owner_headers)
        assert response.status_code == 200

    def test_owner_retry(self, admin_fixture):
        client, owner_headers, *_, session = admin_fixture
        ft_id = self._seed_one(session)
        with patch.dict("backend.celery_app.app.tasks", {"tasks.rbac_test": MagicMock()}, clear=False):
            response = client.post(f"/api/admin/failed-tasks/{ft_id}/retry", headers=owner_headers)
        assert response.status_code == 200

    # -- Manager (should get 403) --

    def test_manager_list_403(self, admin_fixture):
        client, _, manager_headers, *_ = admin_fixture
        response = client.get("/api/admin/failed-tasks/", headers=manager_headers)
        assert response.status_code == 403

    def test_manager_detail_403(self, admin_fixture):
        client, _, manager_headers, __, session = admin_fixture
        ft_id = self._seed_one(session)
        response = client.get(f"/api/admin/failed-tasks/{ft_id}", headers=manager_headers)
        assert response.status_code == 403

    def test_manager_retry_403(self, admin_fixture):
        client, _, manager_headers, __, session = admin_fixture
        ft_id = self._seed_one(session)
        response = client.post(f"/api/admin/failed-tasks/{ft_id}/retry", headers=manager_headers)
        assert response.status_code == 403

    # -- Warehouse (should get 403) --

    def test_warehouse_list_403(self, admin_fixture):
        client, *_, warehouse_headers, __ = admin_fixture[:4]
        response = client.get("/api/admin/failed-tasks/", headers=warehouse_headers)
        assert response.status_code == 403

    def test_warehouse_detail_403(self, admin_fixture):
        client, *_, warehouse_headers, session = admin_fixture
        ft_id = self._seed_one(session)
        response = client.get(f"/api/admin/failed-tasks/{ft_id}", headers=warehouse_headers)
        assert response.status_code == 403

    def test_warehouse_retry_403(self, admin_fixture):
        client, *_, warehouse_headers, session = admin_fixture
        ft_id = self._seed_one(session)
        response = client.post(f"/api/admin/failed-tasks/{ft_id}/retry", headers=warehouse_headers)
        assert response.status_code == 403

    # -- Unauthenticated (should get 401) --

    def test_unauthenticated_list_401(self, admin_fixture):
        client, *_ = admin_fixture
        response = client.get("/api/admin/failed-tasks/")
        assert response.status_code == 401

    def test_unauthenticated_detail_401(self, admin_fixture):
        client, *_ = admin_fixture
        response = client.get("/api/admin/failed-tasks/1")
        assert response.status_code == 401

    def test_unauthenticated_retry_401(self, admin_fixture):
        client, *_ = admin_fixture
        response = client.post("/api/admin/failed-tasks/1/retry")
        assert response.status_code == 401
