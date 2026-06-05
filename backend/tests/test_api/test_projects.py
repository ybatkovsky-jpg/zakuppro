"""
FastAPI Project CRUD endpoint integration tests.

Tests verify:
- POST /api/projects creates projects
- GET /api/projects returns list with pagination
- GET /api/projects/{id} returns project with eager-loaded items
- PUT /api/projects/{id} modifies fields
- DELETE /api/projects/{id} removes projects (cascade deletes items)
- Validation errors return 422
- Not found errors return 404
"""
import pytest
from fastapi.testclient import TestClient


class TestCreateProject:
    """Test POST /api/projects endpoint."""

    def test_create_project_success(self, auth_client: TestClient):
        """POST returns 201 with created project including id."""
        payload = {
            "name": "New Construction Project",
            "client": "BuildCorp LLC",
            "status": "Проектирование",
            "total_cost": 250000.00
        }
        response = auth_client.post("/api/projects/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["id"] > 0
        assert data["name"] == "New Construction Project"
        assert data["client"] == "BuildCorp LLC"
        assert data["status"] == "Проектирование"
        assert data["total_cost"] == 250000.00
        assert "created_at" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) == 0

    def test_create_project_with_defaults(self, auth_client: TestClient):
        """POST creates project with default values for optional fields."""
        payload = {
            "name": "Default Project",
            "client": "Default Client"
        }
        response = auth_client.post("/api/projects/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "Проектирование"  # Default value
        assert data["total_cost"] is None

    def test_create_project_validation_missing_name(self, auth_client: TestClient):
        """POST returns 422 when required field 'name' is missing."""
        payload = {
            "client": "Client Without Name"
        }
        response = auth_client.post("/api/projects/", json=payload)

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Error should mention missing 'name' field
        error_detail = str(data)
        assert "name" in error_detail or "field required" in error_detail.lower()

    def test_create_project_validation_missing_client(self, auth_client: TestClient):
        """POST returns 422 when required field 'client' is missing."""
        payload = {
            "name": "Orphan Project"
        }
        response = auth_client.post("/api/projects/", json=payload)

        assert response.status_code == 422

    def test_create_project_validation_extra_fields(self, auth_client: TestClient):
        """POST ignores extra fields not in schema (FastAPI default)."""
        payload = {
            "name": "Extra Project",
            "client": "Test Client",
            "unexpected_field": "should_be_ignored"
        }
        response = auth_client.post("/api/projects/", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert "unexpected_field" not in data


class TestListProjects:
    """Test GET /api/projects endpoint."""

    def test_list_projects_empty(self, auth_client: TestClient):
        """GET returns empty list when no projects exist."""
        response = auth_client.get("/api/projects/")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_projects_with_data(self, auth_client: TestClient):
        """GET returns list of all projects."""
        # Create two projects
        auth_client.post("/api/projects/", json={
            "name": "Project A",
            "client": "Client A"
        })
        auth_client.post("/api/projects/", json={
            "name": "Project B",
            "client": "Client B"
        })

        response = auth_client.get("/api/projects/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Project A"
        assert data[1]["name"] == "Project B"

    def test_list_projects_pagination(self, auth_client: TestClient):
        """GET respects skip and limit query parameters."""
        # Create 5 projects
        for i in range(5):
            auth_client.post("/api/projects/", json={
                "name": f"Project {i}",
                "client": f"Client {i}"
            })

        # Test skip
        response = auth_client.get("/api/projects/?skip=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Test limit
        response = auth_client.get("/api/projects/?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Test both
        response = auth_client.get("/api/projects/?skip=1&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestGetProject:
    """Test GET /api/projects/{id} endpoint."""

    def test_get_project_success(self, auth_client: TestClient):
        """GET returns project with id."""
        create_response = auth_client.post("/api/projects/", json={
            "name": "Target Project",
            "client": "Target Client",
            "status": "В работе"
        })
        project_id = create_response.json()["id"]

        response = auth_client.get(f"/api/projects/{project_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == "Target Project"
        assert data["client"] == "Target Client"
        assert data["status"] == "В работе"

    def test_get_project_with_eager_loaded_items(self, auth_client: TestClient):
        """GET returns project with items array included (eager loading)."""
        # Create project via API
        project_response = auth_client.post("/api/projects/", json={
            "name": "Project with Items",
            "client": "Items Client",
            "status": "Проектирование"
        })
        project_id = project_response.json()["id"]

        # Create items via API
        for i in range(3):
            auth_client.post("/api/project-items/", json={
                "project_id": project_id,
                "name": f"Item {i}",
                "sku": f"SKU-{i}",
                "qty": 10 + i,
                "status": "К закупке"
            })

        response = auth_client.get(f"/api/projects/{project_id}")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 3
        assert data["items"][0]["name"] == "Item 0"
        assert data["items"][1]["name"] == "Item 1"
        # Items should have all fields
        assert "id" in data["items"][0]
        assert "sku" in data["items"][0]
        assert "qty" in data["items"][0]

    def test_get_project_not_found(self, auth_client: TestClient):
        """GET returns 404 when project id doesn't exist."""
        response = auth_client.get("/api/projects/99999")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()


class TestUpdateProject:
    """Test PUT /api/projects/{id} endpoint."""

    def test_update_project_success(self, auth_client: TestClient):
        """PUT modifies project fields and returns updated data."""
        create_response = auth_client.post("/api/projects/", json={
            "name": "Original Name",
            "client": "Original Client",
            "status": "Проектирование"
        })
        project_id = create_response.json()["id"]

        update_payload = {
            "name": "Updated Name",
            "status": "В работе"
        }
        response = auth_client.put(f"/api/projects/{project_id}", json=update_payload)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == "Updated Name"
        assert data["client"] == "Original Client"  # Unchanged
        assert data["status"] == "В работе"

    def test_update_project_partial(self, auth_client: TestClient):
        """PUT with partial fields only updates provided fields."""
        create_response = auth_client.post("/api/projects/", json={
            "name": "Partial Update Test",
            "client": "Test Client",
            "status": "Проектирование",
            "total_cost": 1000.0
        })
        project_id = create_response.json()["id"]

        # Only update total_cost
        response = auth_client.put(f"/api/projects/{project_id}", json={
            "total_cost": 5000.0
        })

        assert response.status_code == 200
        data = response.json()
        assert data["total_cost"] == 5000.0
        assert data["name"] == "Partial Update Test"  # Unchanged

    def test_update_project_not_found(self, auth_client: TestClient):
        """PUT returns 404 when project id doesn't exist."""
        response = auth_client.put("/api/projects/99999", json={
            "name": "Should Not Work"
        })

        assert response.status_code == 404


class TestDeleteProject:
    """Test DELETE /api/projects/{id} endpoint."""

    def test_delete_project_success(self, auth_client: TestClient):
        """DELETE removes project and returns 204."""
        create_response = auth_client.post("/api/projects/", json={
            "name": "To Be Deleted",
            "client": "Doomed Client"
        })
        project_id = create_response.json()["id"]

        response = auth_client.delete(f"/api/projects/{project_id}")

        assert response.status_code == 204
        assert response.content == b""

        # Verify project is gone
        get_response = auth_client.get(f"/api/projects/{project_id}")
        assert get_response.status_code == 404

    def test_delete_project_cascade_items(self, auth_client: TestClient):
        """DELETE cascade deletes associated project items."""
        # Create project via API
        project_response = auth_client.post("/api/projects/", json={
            "name": "Cascade Test Project",
            "client": "Cascade Client",
            "status": "Проектирование"
        })
        project_id = project_response.json()["id"]

        # Create items via API
        item1_response = auth_client.post("/api/project-items/", json={
            "project_id": project_id,
            "name": "Doomed Item 1",
            "sku": "DOOM-1",
            "qty": 10,
            "status": "К закупке"
        })
        item2_response = auth_client.post("/api/project-items/", json={
            "project_id": project_id,
            "name": "Doomed Item 2",
            "sku": "DOOM-2",
            "qty": 5,
            "status": "К закупке"
        })
        item_ids = [item1_response.json()["id"], item2_response.json()["id"]]

        # Delete project via API
        response = auth_client.delete(f"/api/projects/{project_id}")
        assert response.status_code == 204

        # Verify items are cascade deleted by trying to GET them
        # They should return 404 since project was deleted
        for item_id in item_ids:
            item_response = auth_client.get(f"/api/project-items/{item_id}")
            # Items should be deleted (404) or we get some error
            # With cascade delete, items are removed
            assert item_response.status_code == 404

    def test_delete_project_not_found(self, auth_client: TestClient):
        """DELETE returns 404 when project id doesn't exist."""
        response = auth_client.delete("/api/projects/99999")

        assert response.status_code == 404


class TestProjectItemsIntegration:
    """Test project-item relationship through API."""

    def test_project_response_includes_items_array(self, auth_client: TestClient):
        """Verify ProjectResponse schema includes empty items array by default."""
        # Create project via API
        project_response = auth_client.post("/api/projects/", json={
            "name": "Empty Items Project",
            "client": "Test Client",
            "status": "Проектирование"
        })
        project_id = project_response.json()["id"]

        response = auth_client.get(f"/api/projects/{project_id}")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
        assert len(data["items"]) == 0  # Empty for project with no items


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
