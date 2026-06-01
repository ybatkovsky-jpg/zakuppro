---
estimated_steps: 18
estimated_files: 1
skills_used: []
---

# T02: Create Supplier Resolver Module

## Why
AI extraction returns supplier names (strings), but ProjectItem requires supplier_id (integer). This module bridges the gap by finding existing suppliers or auto-creating them with placeholder email addresses.

## Do
1. Create `backend/supplier_resolver.py` with function:
   ```python
   def find_or_create_supplier(db: Session, name: str) -> Optional[int]:
   ```
2. Query existing Supplier by exact name match (case-sensitive)
3. If not found, create with:
   - name: provided value
   - email: `auto-{slugify(name)}@placeholder.com` placeholder format
4. Commit and return supplier.id
5. Import from `backend.models` for Supplier model
6. Use python-slugify for safe email generation

## Done when
- Module imports successfully
- Function returns valid supplier_id
- Duplicate calls for same name return same ID

## Inputs

- `backend/models.py`
- `backend/database.py`

## Expected Output

- `backend/supplier_resolver.py`

## Verification

python -c "from backend.supplier_resolver import find_or_create_supplier; print('Module imported successfully')"
