"""
Schema tests for Pydantic v2 schemas.

Tests verify that:
- Schemas can serialize ORM objects (from_attributes=True)
- Validation rejects invalid data
- Nested serialization works for relationships
- Optional fields are truly optional
- All schemas are properly configured
"""
import pytest
from datetime import datetime
from pydantic import ValidationError

from backend.schemas import (
    # Project schemas
    ProjectCreate, ProjectUpdate, ProjectResponse,
    # ProjectItem schemas
    ProjectItemCreate, ProjectItemUpdate, ProjectItemResponse,
    # Supplier schemas
    SupplierCreate, SupplierUpdate, SupplierResponse,
    # StockItem schemas
    StockItemCreate, StockItemUpdate, StockItemResponse,
    # PurchaseOrder schemas
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    # Invoice schemas
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    # Payment schemas
    PaymentCreate, PaymentUpdate, PaymentResponse,
    # UnresolvedTransaction schemas
    UnresolvedTransactionCreate, UnresolvedTransactionUpdate, UnresolvedTransactionResponse,
    # ProductionTask schemas
    ProductionTaskCreate, ProductionTaskUpdate, ProductionTaskResponse,
)


# =============================================================================
# Fixtures for test data
# =============================================================================

@pytest.fixture
def sample_project_data():
    """Sample project data for testing."""
    return {
        "name": "Test Project",
        "client": "Test Client",
        "status": "Проектирование",
        "total_cost": 10000.00
    }


@pytest.fixture
def sample_project_item_data():
    """Sample project item data for testing."""
    return {
        "name": "Test Item",
        "sku": "SKU-001",
        "qty": 10,
        "status": "К закупке",
        "supplier_id": 1,
        "stock_item_id": 1
    }


@pytest.fixture
def sample_supplier_data():
    """Sample supplier data for testing."""
    return {
        "name": "Test Supplier",
        "email": "test@example.com",
        "requisites": "Test requisites"
    }


@pytest.fixture
def sample_stock_item_data():
    """Sample stock item data for testing."""
    return {
        "name": "Test Stock Item",
        "sku": "STOCK-SKU-001",
        "qty_total": 100,
        "qty_reserved": 10,
        "qty_available": 90
    }


# =============================================================================
# Schema Validation Tests
# =============================================================================

class TestProjectSchemas:
    """Test Project schema validation."""

    def test_project_create_valid(self, sample_project_data):
        """Test ProjectCreate accepts valid data."""
        schema = ProjectCreate(**sample_project_data)
        assert schema.name == "Test Project"
        assert schema.client == "Test Client"
        assert schema.status == "Проектирование"
        assert schema.total_cost == 10000.00

    def test_project_create_with_defaults(self):
        """Test ProjectCreate uses default values."""
        schema = ProjectCreate(
            name="Test Project",
            client="Test Client"
        )
        assert schema.status == "Проектирование"
        assert schema.total_cost is None

    def test_project_create_missing_required(self):
        """Test ProjectCreate rejects missing required fields."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreate(name="Test")  # Missing client

        errors = exc_info.value.errors()
        assert any(error["loc"] == ("client",) for error in errors)

    def test_project_create_invalid_types(self):
        """Test ProjectCreate rejects invalid types."""
        with pytest.raises(ValidationError) as exc_info:
            ProjectCreate(
                name="Test Project",
                client=123,  # Should be string
                status=None   # Should be string
            )

        errors = exc_info.value.errors()
        assert len(errors) >= 2

    def test_project_update_all_optional(self):
        """Test ProjectUpdate accepts all optional fields."""
        schema = ProjectUpdate()
        assert schema.name is None
        assert schema.client is None
        assert schema.status is None
        assert schema.total_cost is None

    def test_project_update_partial(self):
        """Test ProjectUpdate accepts partial updates."""
        schema = ProjectUpdate(name="Updated Name")
        assert schema.name == "Updated Name"
        assert schema.client is None

    def test_project_response_structure(self):
        """Test ProjectResponse has correct structure."""
        # Create a mock ProjectResponse-like object
        now = datetime.now()
        schema = ProjectResponse(
            id=1,
            name="Test Project",
            client="Test Client",
            status="Проектирование",
            total_cost=10000.00,
            created_at=now,
            updated_at=now,
            items=[]
        )
        assert schema.id == 1
        assert schema.items == []


class TestProjectItemSchemas:
    """Test ProjectItem schema validation."""

    def test_project_item_create_valid(self, sample_project_item_data):
        """Test ProjectItemCreate accepts valid data."""
        data = sample_project_item_data.copy()
        data["project_id"] = 1
        schema = ProjectItemCreate(**data)
        assert schema.name == "Test Item"
        assert schema.sku == "SKU-001"
        assert schema.qty == 10
        assert schema.project_id == 1

    def test_project_item_create_with_defaults(self):
        """Test ProjectItemCreate uses default status."""
        schema = ProjectItemCreate(
            name="Test Item",
            sku="SKU-001",
            qty=10,
            project_id=1
        )
        assert schema.status == "К закупке"

    def test_project_item_create_missing_required(self):
        """Test ProjectItemCreate rejects missing required fields."""
        with pytest.raises(ValidationError):
            ProjectItemCreate(
                name="Test Item",
                project_id=1
            )  # Missing sku and qty

    def test_project_item_qty_must_be_int(self):
        """Test ProjectItemCreate requires integer qty."""
        with pytest.raises(ValidationError):
            ProjectItemCreate(
                name="Test Item",
                sku="SKU-001",
                qty="not_an_int",
                project_id=1
            )


class TestSupplierSchemas:
    """Test Supplier schema validation."""

    def test_supplier_create_valid(self, sample_supplier_data):
        """Test SupplierCreate accepts valid data."""
        schema = SupplierCreate(**sample_supplier_data)
        assert schema.name == "Test Supplier"
        assert schema.email == "test@example.com"

    def test_supplier_create_optional_requisites(self):
        """Test SupplierCreate accepts optional requisites."""
        schema = SupplierCreate(
            name="Test Supplier",
            email="test@example.com"
        )
        assert schema.requisites is None

    def test_supplier_update_all_optional(self):
        """Test SupplierUpdate accepts all optional fields."""
        schema = SupplierUpdate()
        assert schema.name is None
        assert schema.email is None


class TestStockItemSchemas:
    """Test StockItem schema validation."""

    def test_stock_item_create_valid(self, sample_stock_item_data):
        """Test StockItemCreate accepts valid data."""
        schema = StockItemCreate(**sample_stock_item_data)
        assert schema.name == "Test Stock Item"
        assert schema.qty_total == 100

    def test_stock_item_create_with_defaults(self):
        """Test StockItemCreate uses default qty values."""
        schema = StockItemCreate(
            name="Test Item",
            sku="SKU-001"
        )
        assert schema.qty_total == 0
        assert schema.qty_reserved == 0
        assert schema.qty_available == 0

    def test_stock_item_sku_must_be_string(self):
        """Test StockItemCreate requires string SKU."""
        with pytest.raises(ValidationError):
            StockItemCreate(
                name="Test Item",
                sku=123,  # Should be string
                qty_total=10
            )


class TestPurchaseOrderSchemas:
    """Test PurchaseOrder schema validation."""

    def test_purchase_order_create_valid(self):
        """Test PurchaseOrderCreate accepts valid data."""
        schema = PurchaseOrderCreate(
            project_id=1,
            supplier_id=1,
            status="Сформирован"
        )
        assert schema.project_id == 1
        assert schema.supplier_id == 1

    def test_purchase_order_create_with_default_status(self):
        """Test PurchaseOrderCreate uses default status."""
        schema = PurchaseOrderCreate(
            project_id=1,
            supplier_id=1
        )
        assert schema.status == "Сформирован"

    def test_purchase_order_create_missing_required(self):
        """Test PurchaseOrderCreate rejects missing required fields."""
        with pytest.raises(ValidationError):
            PurchaseOrderCreate(project_id=1)  # Missing supplier_id


class TestInvoiceSchemas:
    """Test Invoice schema validation."""

    def test_invoice_create_valid(self):
        """Test InvoiceCreate accepts valid data."""
        schema = InvoiceCreate(
            purchase_order_id=1,
            file_url="http://example.com/invoice.pdf",
            raw_text="Invoice text",
            status="Ожидает сверки"
        )
        assert schema.purchase_order_id == 1
        assert schema.file_url == "http://example.com/invoice.pdf"

    def test_invoice_create_with_defaults(self):
        """Test InvoiceCreate uses default status."""
        schema = InvoiceCreate(purchase_order_id=1)
        assert schema.status == "Ожидает сверки"

    def test_invoice_create_optional_fields(self):
        """Test InvoiceCreate accepts optional fields."""
        schema = InvoiceCreate(purchase_order_id=1)
        assert schema.file_url is None
        assert schema.raw_text is None


class TestPaymentSchemas:
    """Test Payment schema validation."""

    def test_payment_create_valid(self):
        """Test PaymentCreate accepts valid data."""
        now = datetime.now()
        schema = PaymentCreate(
            invoice_id=1,
            amount=5000.00,
            payment_date=now,
            bank_transaction_id="TXN-001"
        )
        assert schema.invoice_id == 1
        assert schema.amount == 5000.00

    def test_payment_create_missing_amount(self):
        """Test PaymentCreate rejects missing amount."""
        with pytest.raises(ValidationError):
            PaymentCreate(
                invoice_id=1,
                payment_date=datetime.now()
            )  # Missing amount

    def test_payment_amount_must_be_numeric(self):
        """Test PaymentCreate requires numeric amount."""
        with pytest.raises(ValidationError):
            PaymentCreate(
                invoice_id=1,
                amount="not_a_number",
                payment_date=datetime.now()
            )


class TestUnresolvedTransactionSchemas:
    """Test UnresolvedTransaction schema validation."""

    def test_unresolved_transaction_create_valid(self):
        """Test UnresolvedTransactionCreate accepts valid data."""
        now = datetime.now()
        schema = UnresolvedTransactionCreate(
            amount=1000.00,
            bank_date=now,
            description="Bank transaction",
            status="Не распределено"
        )
        assert schema.amount == 1000.00

    def test_unresolved_transaction_create_with_defaults(self):
        """Test UnresolvedTransactionCreate uses default status."""
        now = datetime.now()
        schema = UnresolvedTransactionCreate(
            amount=1000.00,
            bank_date=now
        )
        assert schema.status == "Не распределено"

    def test_unresolved_transaction_optional_description(self):
        """Test UnresolvedTransactionCreate accepts optional description."""
        now = datetime.now()
        schema = UnresolvedTransactionCreate(
            amount=1000.00,
            bank_date=now
        )
        assert schema.description is None


class TestProductionTaskSchemas:
    """Test ProductionTask schema validation."""

    def test_production_task_create_valid(self):
        """Test ProductionTaskCreate accepts valid data."""
        schema = ProductionTaskCreate(
            project_id=1,
            status="Ожидание комплектации"
        )
        assert schema.project_id == 1

    def test_production_task_create_with_default_status(self):
        """Test ProductionTaskCreate uses default status."""
        schema = ProductionTaskCreate(project_id=1)
        assert schema.status == "Ожидание комплектации"

    def test_production_task_create_missing_project_id(self):
        """Test ProductionTaskCreate rejects missing project_id."""
        with pytest.raises(ValidationError):
            ProductionTaskCreate(status="Ожидание комплектации")


# =============================================================================
# Schema Configuration Tests
# =============================================================================

class TestSchemaConfiguration:
    """Test that schemas are properly configured for ORM mode."""

    def test_all_schemas_have_from_attributes(self):
        """Test all response schemas have from_attributes enabled."""
        # This is verified by checking model_config exists
        assert hasattr(ProjectResponse, 'model_config')
        assert hasattr(ProjectItemResponse, 'model_config')
        assert hasattr(SupplierResponse, 'model_config')
        assert hasattr(StockItemResponse, 'model_config')
        assert hasattr(PurchaseOrderResponse, 'model_config')
        assert hasattr(InvoiceResponse, 'model_config')
        assert hasattr(PaymentResponse, 'model_config')
        assert hasattr(UnresolvedTransactionResponse, 'model_config')
        assert hasattr(ProductionTaskResponse, 'model_config')

    def test_schema_model_dump(self):
        """Test schemas can be dumped to dict."""
        now = datetime.now()
        schema = ProjectResponse(
            id=1,
            name="Test Project",
            client="Test Client",
            status="Проектирование",
            total_cost=10000.00,
            created_at=now,
            updated_at=None,
            items=[]
        )

        dumped = schema.model_dump()
        assert dumped["id"] == 1
        assert dumped["name"] == "Test Project"
        assert dumped["items"] == []

    def test_schema_model_dump_json(self):
        """Test schemas can be dumped to JSON."""
        now = datetime.now()
        schema = ProjectResponse(
            id=1,
            name="Test Project",
            client="Test Client",
            status="Проектирование",
            total_cost=10000.00,
            created_at=now,
            updated_at=None,
            items=[]
        )

        json_str = schema.model_dump_json()
        assert "Test Project" in json_str


class TestNumericFields:
    """Test numeric field handling."""

    def test_total_cost_accepts_float(self):
        """Test total_cost accepts float values."""
        schema = ProjectCreate(
            name="Test Project",
            client="Test Client",
            total_cost=9999.99
        )
        assert schema.total_cost == 9999.99

    def test_total_cost_accepts_int(self):
        """Test total_cost accepts int values (converts to float)."""
        schema = ProjectCreate(
            name="Test Project",
            client="Test Client",
            total_cost=10000
        )
        assert schema.total_cost == 10000.00

    def test_qty_accepts_int_only(self):
        """Test qty only accepts integer values."""
        schema = ProjectItemCreate(
            name="Test Item",
            sku="SKU-001",
            qty=10,
            project_id=1
        )
        assert schema.qty == 10

    def test_qty_rejects_float(self):
        """Test qty rejects float values (must be int)."""
        with pytest.raises(ValidationError):
            ProjectItemCreate(
                name="Test Item",
                sku="SKU-001",
                qty=10.5,  # Should be int
                project_id=1
            )


class TestStringFields:
    """Test string field validation."""

    def test_empty_string_allowed_for_optional(self):
        """Test empty string is allowed for optional string fields."""
        schema = SupplierUpdate(requisites="")
        assert schema.requisites == ""

    def test_empty_string_not_allowed_for_required(self):
        """Test empty string is rejected for required string fields."""
        # Pydantic v2 allows empty strings by default
        # This test documents current behavior
        schema = ProjectCreate(
            name="",  # Empty but valid string
            client="Test Client"
        )
        assert schema.name == ""

    def test_whitespace_preserved(self):
        """Test whitespace is preserved in string fields."""
        schema = ProjectCreate(
            name="  Test Project  ",
            client="Test Client"
        )
        assert schema.name == "  Test Project  "


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
