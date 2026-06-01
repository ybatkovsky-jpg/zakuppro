---
estimated_steps: 70
estimated_files: 1
skills_used: []
---

# T02: Create Pydantic v2 schemas in schemas.py

## Why This Task Exists

FastAPI needs Pydantic schemas for request/response validation. Pydantic v2 (already in requirements.txt) requires `from_attributes=True` to work with SQLAlchemy ORM objects. This task creates separate Create/Update/Response schemas for all 9 entities.

## What To Do

1. Create `backend/schemas.py` with the following structure:

```python
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

# Base config for all schemas
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# Project schemas
class ProjectBase(BaseSchema):
    name: str
    client: str
    status: str = "Проектирование"
    total_cost: Optional[float] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseSchema):
    name: Optional[str] = None
    client: Optional[str] = None
    status: Optional[str] = None
    total_cost: Optional[float] = None

class ProjectItemResponse(BaseSchema):
    id: int
    name: str
    sku: str
    qty: int
    status: str
    supplier_id: Optional[int] = None
    stock_item_id: Optional[int] = None
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[ProjectItemResponse] = []

# Similar pattern for other entities:
# - ProjectItem (Create/Update/Response)
# - Supplier (Create/Update/Response)
# - StockItem (Create/Update/Response)
# - PurchaseOrder (Create/Update/Response)
# - Invoice (Create/Update/Response)
# - Payment (Create/Update/Response)
# - UnresolvedTransaction (Create/Update/Response)
# - ProductionTask (Create/Update/Response)
```

2. For nested relationships, use the corresponding `*Response` schema type
3. All Response schemas must include `id` and timestamp fields
4. All Update schemas must have all Optional fields
5. Use `float` for Numeric fields (Pydantic converts appropriately)

## Schemas to Create

- `ProjectCreate`, `ProjectUpdate`, `ProjectResponse` (with nested `items`)
- `ProjectItemCreate`, `ProjectItemUpdate`, `ProjectItemResponse`
- `SupplierCreate`, `SupplierUpdate`, `SupplierResponse`
- `StockItemCreate`, `StockItemUpdate`, `StockItemResponse`
- `PurchaseOrderCreate`, `PurchaseOrderUpdate`, `PurchaseOrderResponse`
- `InvoiceCreate`, `InvoiceUpdate`, `InvoiceResponse`
- `PaymentCreate`, `PaymentUpdate`, `PaymentResponse`
- `UnresolvedTransactionCreate`, `UnresolvedTransactionUpdate`, `UnresolvedTransactionResponse`
- `ProductionTaskCreate`, `ProductionTaskUpdate`, `ProductionTaskResponse`

## Done When

- All 27 schemas exist (9 entities × 3 types)
- All schemas use `model_config = ConfigDict(from_attributes=True)`
- Response schemas include `id` and timestamps
- Update schemas have all Optional fields
- File has no syntax errors (Python can import it)

## Inputs

- `backend/models.py`

## Expected Output

- `backend/schemas.py`

## Verification

python -c "from backend.schemas import ProjectCreate, ProjectResponse; print('Schemas imported successfully')"

## Observability Impact

Schemas enable request validation; failure shows as ValidationError during FastAPI requests
