# S04: Verification Logic + Fuzzy Matching

**Goal:** Implement invoice verification service with fuzzy matching to reconcile parsed invoice items against project BOM, linking InvoiceItems to ProjectItems and storing structured verification results in Invoice.verification_result JSONB.
**Demo:** invoice_verifier.py compares invoice items against ProjectItem by purchase_order. SKU matches → OK. SKU differs + RapidFuzz similarity >85% → clarification flag. Quantity differs → partial flag. Verification result saved to Invoice.verification_result JSONB.

## Must-Haves

- invoice_verifier.py service implements multi-tier matching: exact SKU match → fuzzy name match (>85%) → clarification flag (60-85%) → unmapped
- RapidFuzz integration with WRatio for Russian/English text matching
- Celery task verify_invoice links InvoiceItems to ProjectItems and updates Invoice.status based on verdict
- Unit tests cover: exact match, fuzzy match, quantity discrepancy, extra/missing items
- Integration tests verify full pipeline: InvoiceItem.project_item_id population, verification_result JSONB structure
- rapidfuzz==3.9.0 added to requirements.txt

## Proof Level

- This slice proves: Executable unit tests (pytest) + integration tests with database verification

## Integration Closure

After S04: parse_invoice → verify_invoice task chain ready. InvoiceItem.project_item_id populated for matched items. Invoice.verification_result JSONB contains structured verdict. Invoice.status updated (Сверен/Ошибки/Ожидает сверки). S05 will consume verification results for notifications.

## Verification

- Invoice.verification_result JSONB provides structured audit trail of matching decisions
- Celery task logs include match counts and similarity scores for debugging
- Unit tests verify matching logic transparency

## Tasks

- [x] **T01: Add rapidfuzz dependency** `est:5m`
  ## Why
  RapidFuzz is required for fuzzy string matching to reconcile invoice items with project BOM items when SKUs or names differ slightly.
  - Files: `backend/requirements.txt`
  - Verify: grep rapidfuzz backend/requirements.txt

- [x] **T02: Create verification schemas** `est:20m`
  ## Why
  Pydantic schemas provide structured validation for verification results stored in Invoice.verification_result JSONB column.
  - Files: `backend/schemas/__init__.py`, `backend/schemas/verification.py`
  - Verify: python -c "from backend.schemas.verification import VerificationResult; print('VerificationResult imported successfully')"

- [x] **T03: Implement invoice_verifier service** `est:60m`
  ## Why
  Core business logic for invoice verification. Matches invoice items to project BOM using exact SKU matching and RapidFuzz fuzzy name matching.
  - Files: `backend/services/invoice_verifier.py`
  - Verify: python -c "from backend.services.invoice_verifier import verify_invoice; print('verify_invoice imported successfully')"

- [x] **T04: Add verify_invoice Celery task** `est:20m`
  ## Why
  Celery task enables asynchronous verification after invoice parsing, integrating into the parse_invoice → verify_invoice pipeline.
  - Files: `backend/tasks.py`
  - Verify: grep -n "verify_invoice" backend/tasks.py

- [x] **T05: Create unit tests for invoice_verifier** `est:60m`
  ## Why
  Unit tests verify fuzzy matching logic correctness with isolated test cases for each matching tier.
  - Files: `backend/tests/test_invoice_verifier.py`
  - Verify: cd backend && pytest tests/test_invoice_verifier.py -v

- [ ] **T06: Create integration tests for verification** `est:60m`
  ## Why
  Integration tests verify full pipeline with database operations, ensuring InvoiceItem.project_item_id population and Invoice.verification_result structure.
  - Files: `backend/tests/test_s04_integration.py`
  - Verify: cd backend && pytest tests/test_s04_integration.py -v

## Files Likely Touched

- backend/requirements.txt
- backend/schemas/__init__.py
- backend/schemas/verification.py
- backend/services/invoice_verifier.py
- backend/tasks.py
- backend/tests/test_invoice_verifier.py
- backend/tests/test_s04_integration.py
