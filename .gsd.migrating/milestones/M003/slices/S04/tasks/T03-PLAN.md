---
estimated_steps: 28
estimated_files: 1
skills_used: []
---

# T03: Implement invoice_verifier service

## Why
Core business logic for invoice verification. Matches invoice items to project BOM using exact SKU matching and RapidFuzz fuzzy name matching.

## Do
Create `backend/services/invoice_verifier.py` with:

1. `verify_invoice(invoice_id: int, db: Session) -> VerificationResult`
   - Fetch Invoice with InvoiceItems (project_item_id is None from S03)
   - Fetch PurchaseOrder to get project_id
   - Fetch ProjectItems for the project
   - For each InvoiceItem:
     - Try exact SKU match → link, status="matched"
     - No SKU match + RapidFuzz.WRatio(name) > 85 → link, status="fuzzy_match"
     - No SKU match + similarity 60-85 → status="clarification_needed"
     - No match → status="unmapped"
   - Validate quantities (invoice qty vs project item qty)
   - Detect extra items (invoice items with no match)
   - Detect missing items (project items with no invoice match)
   - Update InvoiceItem.project_item_id for matched items
   - Store VerificationResult in Invoice.verification_result
   - Update Invoice.status: "Сверен" (all matched + OK), "Ошибки" (discrepancies), "Ожидает сверки" (clarification needed)

2. Use `rapidfuzz.fuzz.WRatio` for name similarity (handles case, punctuation, Unicode)
3. Use `rapidfuzz.process.extractOne` for batch matching

## Done when
- `backend/services/invoice_verifier.py` implements verify_invoice function
- Exact SKU matching links InvoiceItem to ProjectItem
- Fuzzy name matching uses RapidFuzz with 85% threshold
- Invoice.verification_result JSONB populated with structured results
- Invoice.status updated based on verification verdict
- All InvoiceItems with matches get project_item_id populated

## Inputs

- `backend/models.py`
- `backend/schemas/verification.py`
- `backend/requirements.txt`

## Expected Output

- `backend/services/invoice_verifier.py`

## Verification

python -c "from backend.services.invoice_verifier import verify_invoice; print('verify_invoice imported successfully')"

## Observability Impact

Centralized verification logic with structured output for audit trail
