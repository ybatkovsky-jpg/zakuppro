# S04 — Verification Logic + Fuzzy Matching: Research

**Date:** 2026-06-02

## Objective

Implement invoice verification service that compares parsed invoice items against project BOM (ProjectItems) using fuzzy matching for SKU/name reconciliation and quantity validation. The verifier links InvoiceItem records to ProjectItem records and stores structured results in Invoice.verification_result.

## Implementation Approach

### 1. Service Architecture: `invoice_verifier.py`

Create a new service module `backend/services/invoice_verifier.py` with:

**Core Function: `verify_invoice(invoice_id: int, db: Session) -> VerificationResult`**

Workflow:
1. Fetch Invoice by ID with its InvoiceItems (project_item_id is None from S03)
2. Fetch PurchaseOrder to determine expected ProjectItems
3. For each InvoiceItem, attempt matching:
   - **Exact SKU match** → Link to ProjectItem, status: "matched"
   - **No SKU match + name similarity >85%** → Link to ProjectItem, status: "fuzzy_match"
   - **No SKU match + name similarity 60-85%** → Status: "clarification_needed"
   - **No match found** → Status: "unmapped"
4. Validate quantities: InvoiceItem.qty vs ProjectItem.qty
5. Detect extra/missing items
6. Update InvoiceItem.project_item_id for matched items
7. Store results in Invoice.verification_result (JSONB)
8. Update Invoice.status based on verification outcome

### 2. RapidFuzz Integration

**Dependency Addition:**
```
rapidfuzz==3.9.0
```

**Key Functions to Use:**
- `fuzzy_ratio(str1, str2)` - Levenshtein distance (0-100)
- `fuzzy_partial_ratio(str1, str2)` - Best partial match
- `process.extract(query, choices, limit=N, scorer=fuzzy_ratio)` - Batch matching

**Implementation Pattern:**
```python
from rapidfuzz import fuzz, process

# For invoice item name vs all project item names
choices = [item.name for item in project_items]
match = process.extractOne(
    invoice_item.name, 
    choices, 
    scorer=fuzz.WRatio  # WRatio handles case, punctuation
)
if match and match[1] >= 85:
    project_item = project_items[choices.index(match[0])]
    # Link project_item
```

### 3. Verification Result Schema

**`Invoice.verification_result` JSONB Structure:**
```json
{
  "verdict": "matched" | "partial_match" | "clarification_needed" | "errors",
  "matched_items": 5,
  "fuzzy_matched_items": 2,
  "unmapped_items": 1,
  "quantity_discrepancies": [
    {
      "invoice_item_id": 123,
      "project_item_id": 456,
      "invoice_qty": 100,
      "expected_qty": 150,
      "discrepancy": -50
    }
  ],
  "extra_items": [789],
  "missing_items": [101, 102],
  "items": [
    {
      "invoice_item_id": 123,
      "project_item_id": 456,
      "match_type": "exact" | "fuzzy" | "none",
      "name_similarity": 95,
      "sku_match": true,
      "quantity_match": false
    }
  ],
  "verified_at": "2026-06-02T10:00:00Z"
}
```

### 4. Invoice Status Workflow

After verification, update `Invoice.status`:
- `"Сверен"` - All items matched, quantities OK
- `"Ошибки"` - Quantity discrepancies or unmapped items
- `"Ожидает сверки"` - Clarification needed (fuzzy match 60-85%)

### 5. Celery Task Integration

Add to `backend/tasks.py`:

```python
@celery_app.task(bind=True, name='tasks.verify_invoice')
def verify_invoice_task(self, invoice_id: int) -> dict:
    """
    Celery task for invoice verification.
    Links InvoiceItems to ProjectItems via fuzzy matching.
    """
    try:
        result = invoice_verifier.verify_invoice(invoice_id, db)
        return {"status": "success", "invoice_id": invoice_id, **result}
    except Exception as e:
        # DLQ handling (reusing M002 pattern)
        handle_failed_task(self, e, invoice_id=invoice_id)
        raise
```

**Trigger:** Called automatically after `parse_invoice` completes:
```python
# In parse_invoice task, after saving Invoice
chain(
    parse_invoice.s(file_data, ...),
    verify_invoice.s(invoice_id)
)
```

### 6. Pydantic Models

**`backend/schemas/verification.py`:**
```python
from pydantic import BaseModel
from typing import Optional, List

class ItemVerification(BaseModel):
    invoice_item_id: int
    project_item_id: Optional[int]
    match_type: str  # exact, fuzzy, none
    name_similarity: Optional[int]
    sku_match: bool
    quantity_match: bool

class QuantityDiscrepancy(BaseModel):
    invoice_item_id: int
    project_item_id: int
    invoice_qty: int
    expected_qty: int
    discrepancy: int

class VerificationResult(BaseModel):
    verdict: str
    matched_items: int
    fuzzy_matched_items: int
    unmapped_items: int
    quantity_discrepancies: List[QuantityDiscrepancy]
    extra_items: List[int]
    missing_items: List[int]
    items: List[ItemVerification]
    verified_at: datetime
```

## Testing Strategy

### Unit Tests (`backend/tests/test_invoice_verifier.py`)

1. **Exact SKU Match Test:**
   - InvoiceItem sku="BOLT-001" matches ProjectItem sku="BOLT-001"
   - Verify: project_item_id linked, match_type="exact"

2. **Fuzzy Name Match Test:**
   - InvoiceItem name="Болт М10 ст3" vs ProjectItem name="Болт M10 Ст.3"
   - Verify: similarity >85%, fuzzy match

3. **Name Mismatch Test:**
   - InvoiceItem name="Гайка М10" vs ProjectItem name="Болт М10"
   - Verify: similarity <60%, unmapped

4. **Quantity Discrepancy Test:**
   - InvoiceItem qty=100 vs ProjectItem qty=150
   - Verify: quantity_match=false, discrepancy=-50

5. **Extra Item Test:**
   - InvoiceItem has no matching ProjectItem
   - Verify: in extra_items list

6. **Missing Item Test:**
   - ProjectItem has no matching InvoiceItem
   - Verify: in missing_items list

### Integration Tests

Use test fixtures in `backend/tests/fixtures/`:
- `sample_invoice_items.json` - Parsed invoice items
- `sample_project_items.json` - Expected BOM items

Test full flow:
1. Create Project with ProjectItems
2. Create PurchaseOrder
3. Create Invoice with InvoiceItems (project_item_id=None)
4. Call `verify_invoice_task`
5. Verify InvoiceItem.project_item_id populated
6. Verify Invoice.verification_result structure
7. Verify Invoice.status updated

## Open Questions

1. **Threshold Tuning:** 85% similarity for fuzzy match may need adjustment based on real data. Consider configurable threshold in settings.

2. **Multi-language Matching:** Russian supplier names vs English BOM. RapidFuzz handles Unicode, but may need transliteration (cyrillic-translit package) for better matching.

3. **Price Comparison:** Should verifier also check unit_price? Currently not in scope - adds complexity (price changes, bulk discounts).

4. **Partial Quantity Matching:** If supplier ships partial quantity, should we create second ProjectItem? S05 clarification flow should handle this.

## Dependencies

**New to requirements.txt:**
```
rapidfuzz==3.9.0
```

**Already available (from S03):**
- SQLAlchemy 2.0.35
- Pydantic 2.9.2
- psycopg2-binary 2.9.9

## Implementation Checklist

- [ ] Add rapidfuzz==3.9.0 to requirements.txt
- [ ] Create backend/services/invoice_verifier.py
- [ ] Create backend/schemas/verification.py
- [ ] Add verify_invoice_task to backend/tasks.py
- [ ] Chain verify_invoice after parse_invoice
- [ ] Create unit tests in test_invoice_verifier.py
- [ ] Create integration tests in test_s04_verification.py
- [ ] Update M003-RESEARCH.md with implementation notes
