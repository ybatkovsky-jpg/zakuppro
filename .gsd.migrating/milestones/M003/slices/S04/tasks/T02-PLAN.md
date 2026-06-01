---
estimated_steps: 14
estimated_files: 2
skills_used: []
---

# T02: Create verification schemas

## Why
Pydantic schemas provide structured validation for verification results stored in Invoice.verification_result JSONB column.

## Do
1. Create `backend/schemas/` directory with `__init__.py`
2. Create `backend/schemas/verification.py` with:
   - `ItemVerification` (invoice_item_id, project_item_id, match_type, name_similarity, sku_match, quantity_match)
   - `QuantityDiscrepancy` (invoice_item_id, project_item_id, invoice_qty, expected_qty, discrepancy)
   - `VerificationResult` (verdict, matched_items, fuzzy_matched_items, unmapped_items, quantity_discrepancies, extra_items, missing_items, items, verified_at)
3. Use model_config = ConfigDict(from_attributes=True) for ORM mode
4. Add datetime field for verified_at timestamp

## Done when
- `backend/schemas/verification.py` exists with all required Pydantic models
- Models have proper field types (int, str, bool, List, Optional, datetime)
- model_config uses from_attributes=True for ORM compatibility

## Inputs

- `backend/requirements.txt`

## Expected Output

- `backend/schemas/__init__.py`
- `backend/schemas/verification.py`

## Verification

python -c "from backend.schemas.verification import VerificationResult; print('VerificationResult imported successfully')"

## Observability Impact

Structured schemas enable JSONB validation and serialization
