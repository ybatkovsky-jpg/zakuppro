---
estimated_steps: 70
estimated_files: 1
skills_used: []
---

# T01: Add SQLAlchemy relationships to models.py

## Why This Task Exists

The current `models.py` has all 9 entities defined with columns and foreign keys, but no `relationship()` mappings. Without relationships, we cannot navigate between related objects (e.g., `project.items` or `item.project`). This task adds bidirectional relationships using SQLAlchemy 2.0's `relationship()` API with `back_populates` for clarity.

## What To Do

1. Import `relationship` from `sqlalchemy.orm`
2. Add relationships to each model following these patterns:

**Project → ProjectItem (one-to-many, cascade delete)**
```python
# In Project class:
items = relationship("ProjectItem", back_populates="project", cascade="all, delete-orphan", lazy="selectin")

# In ProjectItem class:
project = relationship("Project", back_populates="items")
```

**Project → PurchaseOrder (one-to-many)**
```python
# In Project class:
purchase_orders = relationship("PurchaseOrder", back_populates="project")

# In PurchaseOrder class:
project = relationship("Project", back_populates="purchase_orders")
```

**Project → ProductionTask (one-to-many)**
```python
# In Project class:
production_tasks = relationship("ProductionTask", back_populates="project")

# In ProductionTask class:
project = relationship("Project", back_populates="production_tasks")
```

**Supplier → PurchaseOrder (one-to-many, RESTRICT on delete)**
```python
# In Supplier class:
purchase_orders = relationship("PurchaseOrder", back_populates="supplier")

# In PurchaseOrder class:
supplier = relationship("Supplier", back_populates="purchase_orders")
```

**ProjectItem → Supplier (many-to-one, optional)**
```python
# In ProjectItem class:
supplier = relationship("Supplier", back_populates="project_items")

# In Supplier class:
project_items = relationship("ProjectItem", back_populates="supplier")
```

**ProjectItem → StockItem (many-to-one, optional)**
```python
# In ProjectItem class:
stock_item = relationship("StockItem", back_populates="project_items")

# In StockItem class:
project_items = relationship("ProjectItem", back_populates="stock_item")
```

**PurchaseOrder → Invoice (one-to-many)**
```python
# In PurchaseOrder class:
invoices = relationship("Invoice", back_populates="purchase_order")

# In Invoice class:
purchase_order = relationship("PurchaseOrder", back_populates="invoices")
```

**Invoice → Payment (one-to-many)**
```python
# In Invoice class:
payments = relationship("Payment", back_populates="invoice")

# In Payment class:
invoice = relationship("Invoice", back_populates="payments")
```

3. Use `lazy="selectin"` for one-to-many relationships to avoid N+1 queries
4. Use `cascade="all, delete-orphan"` for Project→ProjectItem (hierarchical data)
5. Do NOT use cascade for Supplier→PurchaseOrder (reference data uses RESTRICT at DB level)

## Done When

- All models have `relationship()` attributes defined
- Relationships are bidirectional (both sides have `back_populates`)
- Cascade settings match the milestone's foreign key policy
- Import statement for `relationship` is added
- File has no syntax errors (Python can import it)

## Inputs

- `backend/models.py`
- `backend/database.py`

## Expected Output

- `backend/models.py`

## Verification

python -c "from backend.models import Project, ProjectItem, Supplier, StockItem, PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask; print('Models imported successfully')"

## Observability Impact

Relationships enable ORM navigation; failure shows as AttributeError when accessing related objects
