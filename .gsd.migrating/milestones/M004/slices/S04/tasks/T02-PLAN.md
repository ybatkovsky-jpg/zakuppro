---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Create Payment Matcher Core Service

Create payment_matcher.py with PaymentMatcher class following InvoiceVerifier pattern. Implement multi tier matching exact INN plus amount to confidence 1.00, INN plus amount plus minus 5 percent to confidence 0.85 to 0.99. Include private methods for INN extraction, invoice lookup, tolerance checks. Handle edge cases NULL supplier_inn, no invoices, multiple candidates to unresolved. Build Supplier INN lookup cache to avoid repeated text extraction. Query invoices via PurchaseOrder with status in Sveren Ozhidaet oplaty. Return MatchResult dict with matched_count, unresolved_count, payment_ids.

## Inputs

- `backend/services/supplier_inn_extractor.py`
- `backend/models.py`
- `backend/services/invoice_verifier.py`

## Expected Output

- `backend/services/payment_matcher.py`

## Verification

python -c from backend.services.payment_matcher import PaymentMatcher; print OK

## Observability Impact

Logger statements for each matching stage with counts, INN matches, candidates found
