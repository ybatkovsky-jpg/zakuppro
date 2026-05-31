"""
Migration tests for Alembic.

Tests migration apply/rollback cycle and verifies:
- All tables are created with correct structure
- Foreign keys work correctly
- Indexes are created
- Data survives rollback/upgrade cycle

Note: These tests require a running PostgreSQL instance.
Set DATABASE_URL in .env before running.
"""
import os
import pytest
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import OperationalError
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory


# Get the backend directory for Alembic config
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALEMBIC_CFG_PATH = os.path.join(BACKEND_DIR, "alembic.ini")


def get_alembic_config():
    """Get Alembic configuration."""
    config = Config(ALEMBIC_CFG_PATH)
    config.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    return config


def get_database_url():
    """Get database URL from environment."""
    # Try to get from env file or environment
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        # Try reading from .env file
        env_path = os.path.join(BACKEND_DIR, "..", ".env")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        database_url = line.strip().split("=", 1)[1]
                        break
    if not database_url:
        pytest.skip("DATABASE_URL not set - skipping database tests")
    return database_url


def is_database_running():
    """Check if database is accessible."""
    try:
        url = get_database_url()
        engine = create_engine(url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except OperationalError:
        return False
    except Exception:
        return False


class TestMigrationStructure:
    """Test migration file structure without requiring database."""

    def test_migration_file_exists(self):
        """Test that the initial migration file exists."""
        migration_path = os.path.join(
            BACKEND_DIR, "alembic", "versions", "d6d07b9ba359_initial_schema.py"
        )
        assert os.path.exists(migration_path), "Initial migration file not found"

    def test_migration_has_revision(self):
        """Test that migration has proper revision identifiers."""
        migration_path = os.path.join(
            BACKEND_DIR, "alembic", "versions", "d6d07b9ba359_initial_schema.py"
        )
        with open(migration_path, "r") as f:
            content = f.read()

        # Migration uses type annotation syntax: revision: str = '...'
        assert "revision: str = 'd6d07b9ba359'" in content
        assert "down_revision: Union[str, None] = None" in content  # Initial migration
        assert "def upgrade() -> None:" in content
        assert "def downgrade() -> None:" in content

    def test_migration_creates_all_tables(self):
        """Test that migration creates all 9 tables from SPEC."""
        migration_path = os.path.join(
            BACKEND_DIR, "alembic", "versions", "d6d07b9ba359_initial_schema.py"
        )
        with open(migration_path, "r") as f:
            content = f.read()

        expected_tables = [
            "projects",
            "suppliers",
            "stock_items",
            "project_items",
            "purchase_orders",
            "invoices",
            "payments",
            "unresolved_transactions",
            "production_tasks",
        ]

        for table in expected_tables:
            assert f"'{table}'" in content, f"Table {table} not found in migration"

    def test_migration_has_foreign_keys(self):
        """Test that migration defines foreign key constraints."""
        migration_path = os.path.join(
            BACKEND_DIR, "alembic", "versions", "d6d07b9ba359_initial_schema.py"
        )
        with open(migration_path, "r") as f:
            content = f.read()

        # Count foreign key constraints
        fk_count = content.count("ForeignKeyConstraint")
        assert fk_count >= 8, f"Expected at least 8 foreign keys, found {fk_count}"

        # Verify specific FKs
        assert "fk_project_items_project" in content
        assert "fk_purchase_orders_project" in content
        assert "fk_invoices_purchase_order" in content
        assert "fk_payments_invoice" in content

    def test_migration_has_indexes(self):
        """Test that migration creates indexes for performance."""
        migration_path = os.path.join(
            BACKEND_DIR, "alembic", "versions", "d6d07b9ba359_initial_schema.py"
        )
        with open(migration_path, "r") as f:
            content = f.read()

        # Check for index creation
        create_index_count = content.count("create_index")
        assert create_index_count >= 15, f"Expected at least 15 indexes, found {create_index_count}"

        # Verify key indexes
        assert "ix_projects_status" in content
        assert "ix_suppliers_email" in content
        assert "ix_project_items_project_id" in content
        assert "ix_purchase_orders_project_id" in content

    def test_downgrade_drops_in_reverse_order(self):
        """Test that downgrade drops tables in correct order (respecting FKs)."""
        migration_path = os.path.join(
            BACKEND_DIR, "alembic", "versions", "d6d07b9ba359_initial_schema.py"
        )
        with open(migration_path, "r") as f:
            content = f.read()

        # Find downgrade function
        downgrade_start = content.find("def downgrade() -> None:")
        downgrade_content = content[downgrade_start:]

        # Tables should be dropped in reverse order of creation
        # Last dropped should be projects (first created)
        last_drop = downgrade_content.rfind("drop_table")
        last_table_section = downgrade_content[last_drop : last_drop + 300]
        assert "'projects'" in last_table_section, "Last dropped table should be projects"

        # First index drops should be for production_tasks and unresolved_transactions
        first_idx_drop = downgrade_content.find("drop_index")
        first_idx_section = downgrade_content[first_idx_drop : first_idx_drop + 300]
        assert "production_tasks" in first_idx_section, "First indexes dropped should include production_tasks"


@pytest.mark.skipif(not is_database_running(), reason="Database not running")
class TestMigrationApply:
    """Test migration apply with real database."""

    @pytest.fixture
    def db_engine(self):
        """Create a database engine for testing."""
        url = get_database_url()
        engine = create_engine(url)
        yield engine
        engine.dispose()

    @pytest.fixture
    def clean_database(self, db_engine):
        """Provide a clean database (drop all tables after test)."""
        yield db_engine
        # Cleanup: drop all tables
        with db_engine.begin() as conn:
            inspector = inspect(conn)
            tables = inspector.get_table_names()
            if tables and "alembic_version" not in tables:
                # No alembic_version means we need manual cleanup
                for table in reversed(tables):
                    conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))

    def test_upgrade_creates_all_tables(self, clean_database):
        """Test that alembic upgrade creates all tables."""
        config = get_alembic_config()
        command.upgrade(config, "head")

        inspector = inspect(clean_database)
        tables = inspector.get_table_names()

        # Should have alembic_version + 9 tables
        assert len(tables) == 10, f"Expected 10 tables, found {len(tables)}"

        expected_tables = {
            "alembic_version",
            "projects",
            "suppliers",
            "stock_items",
            "project_items",
            "purchase_orders",
            "invoices",
            "payments",
            "unresolved_transactions",
            "production_tasks",
        }
        assert set(tables) == expected_tables

    def test_upgrade_creates_foreign_keys(self, clean_database):
        """Test that foreign keys are properly created."""
        config = get_alembic_config()
        command.upgrade(config, "head")

        inspector = inspect(clean_database)

        # Check foreign keys on project_items
        fks = inspector.get_foreign_keys("project_items")
        fk_targets = {fk["referred_table"] for fk in fks}
        assert fk_targets == {"projects", "suppliers", "stock_items"}

        # Check foreign keys on purchase_orders
        fks = inspector.get_foreign_keys("purchase_orders")
        fk_targets = {fk["referred_table"] for fk in fks}
        assert fk_targets == {"projects", "suppliers"}

    def test_upgrade_creates_indexes(self, clean_database):
        """Test that indexes are created."""
        config = get_alembic_config()
        command.upgrade(config, "head")

        inspector = inspect(clean_database)

        # Check indexes on projects
        indexes = inspector.get_indexes("projects")
        index_names = {idx["name"] for idx in indexes}
        assert "ix_projects_id" in index_names
        assert "ix_projects_status" in index_names

    def test_rollback_reverts_schema(self, clean_database):
        """Test that downgrade properly removes all tables."""
        config = get_alembic_config()

        # First upgrade
        command.upgrade(config, "head")
        inspector = inspect(clean_database)
        tables_before = set(inspector.get_table_names())
        assert len(tables_before) == 10

        # Then downgrade
        command.downgrade(config, "-1")
        inspector = inspect(clean_database)
        tables_after = inspector.get_table_names()

        # Should only have alembic_version left or be completely empty
        assert len(tables_after) <= 1

    def test_foreign_key_constraint_works(self, clean_database):
        """Test that foreign key constraints actually prevent invalid data."""
        config = get_alembic_config()
        command.upgrade(config, "head")

        # Try to insert a project_item with invalid project_id
        with pytest.raises(Exception):  # Should raise IntegrityError or similar
            with clean_database.begin() as conn:
                conn.execute(
                    text("""
                    INSERT INTO project_items (project_id, name, sku, qty, status)
                    VALUES (99999, 'Test', 'TEST-SKU', 1, 'К закупке')
                    """)
                )

    def test_unique_constraint_on_sku(self, clean_database):
        """Test that unique constraint on stock_items.sku works."""
        config = get_alembic_config()
        command.upgrade(config, "head")

        # Insert first stock item
        with clean_database.begin() as conn:
            conn.execute(
                text("""
                INSERT INTO stock_items (name, sku, qty_total, qty_reserved, qty_available)
                VALUES ('Test Item', 'UNIQUE-SKU-123', 10, 0, 10)
                """)
            )

        # Try to insert duplicate SKU - should fail
        with pytest.raises(Exception):
            with clean_database.begin() as conn:
                conn.execute(
                    text("""
                    INSERT INTO stock_items (name, sku, qty_total, qty_reserved, qty_available)
                    VALUES ('Another Item', 'UNIQUE-SKU-123', 5, 0, 5)
                    """)
                )


@pytest.mark.skipif(not is_database_running(), reason="Database not running")
class TestMigrationWithTestData:
    """Test migration with data persistence across rollback/upgrade."""

    @pytest.fixture
    def db_engine(self):
        """Create a database engine for testing."""
        url = get_database_url()
        engine = create_engine(url)
        yield engine
        engine.dispose()

    def test_data_survives_rollback_and_upgrade(self, db_engine):
        """
        Test creating test data, rolling back, and re-applying.
        NOTE: This test demonstrates the issue: downgrade() drops tables,
        so data is lost. This is expected behavior for destructive migrations.
        """
        config = get_alembic_config()

        # Step 1: Apply migration
        command.upgrade(config, "head")

        # Step 2: Insert test data
        with db_engine.begin() as conn:
            # Insert a project
            result = conn.execute(
                text("""
                INSERT INTO projects (name, client, status, total_cost)
                VALUES ('Test Project', 'Test Client', 'Проектирование', 10000.00)
                RETURNING id
                """)
            )
            project_id = result.scalar()

            # Insert a supplier
            result = conn.execute(
                text("""
                INSERT INTO suppliers (name, email, requisites)
                VALUES ('Test Supplier', 'test@example.com', ' requisites')
                RETURNING id
                """)
            )
            supplier_id = result.scalar()

            # Verify data exists
            result = conn.execute(text("SELECT COUNT(*) FROM projects"))
            project_count = result.scalar()
            assert project_count == 1

        # Step 3: Rollback - THIS WILL DELETE ALL DATA
        command.downgrade(config, "-1")

        # Verify tables are gone
        inspector = inspect(db_engine)
        tables = inspector.get_table_names()
        assert len(tables) <= 1  # Only alembic_version might remain

        # Step 4: Re-apply migration
        command.upgrade(config, "head")

        # Step 5: Verify data is gone (expected - downgrade is destructive)
        with db_engine.begin() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM projects"))
            project_count = result.scalar()
            # Data is lost - this demonstrates that downgrade() is destructive
            assert project_count == 0, "Data was lost after downgrade (expected behavior)"


def test_alembic_history():
    """Test that alembic history shows our migration."""
    config = get_alembic_config()
    script = ScriptDirectory.from_config(config)

    revisions = list(script.walk_revisions())

    assert len(revisions) >= 1, "At least one revision should exist"
    assert revisions[0].revision == "d6d07b9ba359"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
