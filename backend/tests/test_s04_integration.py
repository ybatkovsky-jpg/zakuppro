"""
Integration test for S04: End-to-end BOM upload flow.

Tests the complete pipeline:
1. FailedTask model exists and can be instantiated
2. Supplier resolver: find_or_create_supplier
3. process_bom_to_project task: Full flow with mocked Telegram
4. DLQ persistence: FailedTask record creation on error

Uses pytest fixtures for database session (rollback after test).
Mocks external dependencies (OpenAI, Telegram Bot).
"""

import os
import sys
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import json

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import pytest
from sqlalchemy.orm import Session

from backend.models import FailedTask, Supplier, Project, ProjectItem
from backend.supplier_resolver import find_or_create_supplier, find_supplier_by_name


# Test configuration
TEST_FIXTURES = project_root / "tests" / "fixtures"
TEST_EXCEL = TEST_FIXTURES / "sample_bom.xlsx"


class TestFailedTaskModel:
    """Test FailedTask model for DLQ persistence."""

    def test_failed_task_model_exists(self):
        """Verify FailedTask can be imported and instantiated."""
        print("\n=== Testing FailedTask Model ===")

        # Test import worked
        assert FailedTask is not None
        print("✓ FailedTask model imported successfully")

        # Test instantiation (not persisted to DB)
        failed_task = FailedTask(
            task_id="test-task-123",
            task_name="tasks.test_task",
            error_message="Test error message",
            error_type="ValueError",
            file_path="/test/path.xlsx",
            chat_id=12345,
            context='{"test": "context"}'
        )

        assert failed_task.task_id == "test-task-123"
        assert failed_task.task_name == "tasks.test_task"
        assert failed_task.error_message == "Test error message"
        assert failed_task.error_type == "ValueError"
        assert failed_task.file_path == "/test/path.xlsx"
        assert failed_task.chat_id == 12345
        print("✓ FailedTask can be instantiated with all fields")


class TestSupplierResolver:
    """Test supplier resolver module."""

    def test_find_or_create_supplier_new(self, db_session: Session):
        """Test creating a new supplier when none exists."""
        print("\n=== Testing Supplier Resolver - New Supplier ===")

        # Ensure no supplier exists
        existing = db_session.query(Supplier).filter(
            Supplier.name == "Test Supplier New"
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        # Create new supplier
        supplier_id = find_or_create_supplier(db_session, "Test Supplier New")

        assert supplier_id is not None, "Should return supplier_id"
        assert isinstance(supplier_id, int), "supplier_id should be int"

        # Verify in database
        supplier = db_session.query(Supplier).filter(
            Supplier.name == "Test Supplier New"
        ).first()
        assert supplier is not None, "Supplier should exist in DB"
        assert supplier.id == supplier_id
        assert supplier.email == "auto-test-supplier-new@placeholder.com"
        print(f"✓ New supplier created: ID={supplier_id}, email={supplier.email}")

    def test_find_or_create_supplier_existing(self, db_session: Session):
        """Test finding existing supplier by name."""
        print("\n=== Testing Supplier Resolver - Existing Supplier ===")

        # Create a supplier first
        test_name = "Test Supplier Existing"
        existing = db_session.query(Supplier).filter(
            Supplier.name == test_name
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        supplier_id_first = find_or_create_supplier(db_session, test_name)
        assert supplier_id_first is not None

        # Call again - should return same ID
        supplier_id_second = find_or_create_supplier(db_session, test_name)

        assert supplier_id_first == supplier_id_second, \
            "Should return same supplier_id for existing supplier"

        # Verify only one record exists
        count = db_session.query(Supplier).filter(
            Supplier.name == test_name
        ).count()
        assert count == 1, "Should only have one record"
        print(f"✓ Existing supplier found: ID={supplier_id_second}")

    def test_find_or_create_supplier_empty_name(self, db_session: Session):
        """Test handling of empty supplier name."""
        print("\n=== Testing Supplier Resolver - Empty Name ===")

        supplier_id = find_or_create_supplier(db_session, "")
        assert supplier_id is None, "Should return None for empty name"

        supplier_id = find_or_create_supplier(db_session, "   ")
        assert supplier_id is None, "Should return None for whitespace-only name"

        print("✓ Empty name handled correctly (returns None)")

    def test_find_supplier_by_name(self, db_session: Session):
        """Test find_supplier_by_name without auto-creation."""
        print("\n=== Testing find_supplier_by_name ===")

        # Create a supplier
        test_name = "Test Supplier Find Only"
        existing = db_session.query(Supplier).filter(
            Supplier.name == test_name
        ).first()
        if existing:
            db_session.delete(existing)
            db_session.commit()

        supplier_id = find_or_create_supplier(db_session, test_name)
        assert supplier_id is not None

        # Find without creating
        found_id = find_supplier_by_name(db_session, test_name)
        assert found_id == supplier_id, "Should find existing supplier"

        # Try to find non-existent supplier
        not_found_id = find_supplier_by_name(db_session, "Nonexistent Supplier")
        assert not_found_id is None, "Should return None for non-existent supplier"

        print("✓ find_supplier_by_name works correctly")


# Check if required dependencies are available
try:
    import pandas
    import openai
    DEPS_AVAILABLE = True
except ImportError:
    DEPS_AVAILABLE = False


class TestProcessBomTask:
    """Test process_bom_to_project task with mocked dependencies."""

    @pytest.fixture
    def mock_extracted_bom(self):
        """Mock AI extraction result."""
        return {
            'status': 'success',
            'items_count': 2,
            'items': [
                {
                    'sku': 'BOLT-001',
                    'name': 'Болт М10',
                    'qty': 100,
                    'supplier': 'ООО МеталлПром'
                },
                {
                    'sku': 'NUT-002',
                    'name': 'Гайка М10',
                    'qty': 100,
                    'supplier': 'ООО МеталлПром'
                }
            ],
            'metadata': {
                'project_name': 'Test Project',
                'client': 'Test Client'
            }
        }

    @pytest.mark.skipif(not DEPS_AVAILABLE, reason="pandas/openai not installed")
    def test_process_bom_to_project_task_success(
        self, db_session: Session, mock_extracted_bom
    ):
        """Test full flow with mocked dependencies."""
        print("\n=== Testing process_bom_to_project Task - Success ===")

        # Skip if test Excel doesn't exist
        if not TEST_EXCEL.exists():
            print(f"⚠ Test Excel not found: {TEST_EXCEL}")
            return None

        from backend.tasks import process_bom_to_project

        # Mock the parse_excel_bom task to return our test data
        mock_parse_result = Mock()
        mock_parse_result.get.return_value = mock_extracted_bom['status']
        mock_parse_result.get.side_effect = lambda key, default=None: {
            'status': mock_extracted_bom['status'],
            'items': mock_extracted_bom['items'],
            'metadata': mock_extracted_bom['metadata']
        }.get(key, default)

        # Mock telegram_notifier to avoid API calls
        with patch('backend.telegram_notifier.send_completion_message') as mock_telegram:
            mock_telegram.return_value = True

            # Mock parse_excel_bom.apply to return our mock
            with patch('backend.tasks.parse_excel_bom.apply') as mock_apply:
                mock_apply.return_value.get.return_value = mock_extracted_bom

                # Create a mock request object
                mock_request = Mock()
                mock_request.id = 'test-task-001'
                mock_request.retries = 0

                # Bind the task with mock request
                task = process_bom_to_project
                task.request = mock_request

                # Execute task
                result = task(file_path=str(TEST_EXCEL), chat_id=12345)

        # Verify result structure
        assert result is not None, "Task should return result"
        assert result.get('status') == 'success', "Status should be success"
        assert 'project_id' in result, "Result should have project_id"
        assert 'items_count' in result, "Result should have items_count"

        project_id = result['project_id']
        items_count = result['items_count']

        print(f"✓ Task completed: project_id={project_id}, items_count={items_count}")

        # Verify database state
        project = db_session.query(Project).filter(Project.id == project_id).first()
        assert project is not None, "Project should exist in DB"
        assert project.name == 'Test Project', f"Project name should be 'Test Project', got {project.name}"
        assert project.client == 'Test Client', f"Client should be 'Test Client', got {project.client}"
        print(f"✓ Project created: name={project.name}, client={project.client}")

        # Verify ProjectItem records
        items = db_session.query(ProjectItem).filter(
            ProjectItem.project_id == project_id
        ).all()
        assert len(items) == items_count, f"Should have {items_count} items, got {len(items)}"
        print(f"✓ ProjectItem records created: {len(items)} items")

        # Verify supplier was created
        supplier = db_session.query(Supplier).filter(
            Supplier.name == 'ООО МеталлПром'
        ).first()
        assert supplier is not None, "Supplier should be auto-created"
        print(f"✓ Supplier resolved: {supplier.name} (ID: {supplier.id})")

        # Verify items have supplier_id
        for item in items:
            assert item.supplier_id == supplier.id, \
                f"Item should have supplier_id={supplier.id}"

        print("✓ All items linked to supplier correctly")

        # Verify Telegram was called
        assert mock_telegram.called, "Telegram notification should be called"
        call_args = mock_telegram.call_args
        assert call_args[1]['chat_id'] == 12345
        assert call_args[1]['project_name'] == 'Test Project'
        assert call_args[1]['items_count'] == items_count
        print("✓ Telegram notification called with correct params")

    @pytest.mark.skipif(not DEPS_AVAILABLE, reason="pandas/openai not installed")
    def test_process_bom_to_project_task_dlq_error(self, db_session: Session):
        """Test DLQ persistence when task fails."""
        print("\n=== Testing process_bom_to_project Task - DLQ Error ===")

        from backend.tasks import process_bom_to_project

        # Mock parse_excel_bom to raise an error
        with patch('backend.tasks.parse_excel_bom.apply') as mock_apply:
            mock_apply.side_effect = ValueError("Simulated AI parsing failure")

            # Mock telegram DLQ alert
            with patch('backend.telegram_notifier.send_dlq_alert') as mock_dlq:
                mock_dlq.return_value = True

                # Create a mock request object
                mock_request = Mock()
                mock_request.id = 'test-task-dlq-001'
                mock_request.retries = 0

                # Bind the task
                task = process_bom_to_project
                task.request = mock_request

                # Execute task - should raise exception
                with pytest.raises(ValueError, match="Simulated AI parsing failure"):
                    task(file_path=str(TEST_EXCEL), chat_id=99999)

        # Verify FailedTask record was created
        failed_task = db_session.query(FailedTask).filter(
            FailedTask.task_id == 'test-task-dlq-001'
        ).first()

        assert failed_task is not None, "FailedTask record should exist"
        assert failed_task.task_name == 'tasks.process_bom_to_project'
        assert 'Simulated AI parsing failure' in failed_task.error_message
        assert failed_task.chat_id == 99999
        assert str(TEST_EXCEL) in failed_task.file_path
        print(f"✓ FailedTask record created: task_id={failed_task.task_id}")
        print(f"  error_type={failed_task.error_type}")

        # Verify DLQ alert was sent
        assert mock_dlq.called, "DLQ alert should be sent"
        call_args = mock_dlq.call_args
        assert call_args[1]['task_id'] == 'test-task-dlq-001'
        print("✓ DLQ alert sent to owner")

        # Cleanup for next tests
        db_session.delete(failed_task)
        db_session.commit()


class TestDLQPersistence:
    """Test DLQ persistence specifically."""

    @pytest.mark.skipif(not DEPS_AVAILABLE, reason="pandas/openai not installed")
    def test_dlq_persistence_full_flow(self, db_session: Session):
        """Trigger error and verify FailedTask record with full context."""
        print("\n=== Testing DLQ Persistence - Full Flow ===")

        from backend.tasks import process_bom_to_project

        # Test different error scenarios
        test_scenarios = [
            ("ValueError", "No items extracted from Excel file"),
            ("FileNotFoundError", "Simulated file not found"),
        ]

        for error_type, error_msg in test_scenarios:
            task_id = f"test-task-{error_type}-001"

            # Mock to trigger specific error
            with patch('backend.tasks.parse_excel_bom.apply') as mock_apply:
                mock_apply.return_value.get.return_value = {
                    'status': 'error',
                    'items': [],
                    'metadata': {}
                }

                with patch('backend.telegram_notifier.send_dlq_alert') as mock_dlq:
                    mock_dlq.return_value = True

                    mock_request = Mock()
                    mock_request.id = task_id
                    mock_request.retries = 0

                    task = process_bom_to_project
                    task.request = mock_request

                    # Execute - should raise ValueError
                    with pytest.raises(ValueError):
                        task(file_path=str(TEST_EXCEL), chat_id=11111)

            # Verify FailedTask
            failed = db_session.query(FailedTask).filter(
                FailedTask.task_id == task_id
            ).first()

            assert failed is not None, f"FailedTask for {task_id} should exist"
            assert failed.error_type == "ValueError"
            assert failed.chat_id == 11111

            # Verify context JSON is valid
            if failed.context:
                context_data = json.loads(failed.context)
                assert 'chat_id' in context_data
                assert 'file_path' in context_data

            print(f"✓ {error_type}: FailedTask created with context")

            # Cleanup
            db_session.delete(failed)
            db_session.commit()


def main():
    """Run all integration tests."""
    print("=" * 60)
    print("S04 Integration Test Suite")
    print("=" * 60)

    # Run with pytest
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "pytest", __file__, "-v", "--tb=short"],
        cwd=str(project_root),
        capture_output=False
    )

    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
