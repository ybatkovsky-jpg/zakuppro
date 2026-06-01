---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Create Alembic migration for Invoice.raw_file, Invoice.verification_result, InvoiceItem table

Generate Alembic migration to add BYTEA column for BLOB storage, JSONB column for verification results, and InvoiceItem table for line items with foreign keys to Invoice and ProjectItem.

## Inputs

- `Existing Invoice model in models.py`
- `Alembic configuration`

## Expected Output

- `Migration file`
- `Updated models.py with InvoiceItem class`
- `raw_file LargeBinary column`
- `verification_result JSON/JSONB column`

## Verification

alembic upgrade head && psql -c "\d invoices" && psql -c "\d invoice_items"
