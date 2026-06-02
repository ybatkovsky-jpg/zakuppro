---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Create Supplier INN Extractor Service

Create supplier_inn_extractor.py with extract_inn_from_requisites function to parse INN from Supplier.requisites text field. Handle multiple formats including INN colon number, INN space number, inn colon number. Return None if not found. Add comprehensive unit tests for various requisites formats including edge cases missing INN, malformed, uppercase lowercase variants.

## Inputs

- `backend/models.py`

## Expected Output

- `backend/services/supplier_inn_extractor.py`
- `backend/tests/test_supplier_inn_extractor.py`

## Verification

pytest backend/tests/test_supplier_inn_extractor.py -v

## Observability Impact

Logger statements for extraction success failure with INN value
