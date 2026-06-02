---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T05: Create Unit Tests for Payment Matcher

Create test_payment_matcher.py with comprehensive unit tests covering exact INN plus amount match to confidence 1.00, amount within plus minus 5 percent tolerance, amount outside tolerance, payment within 90 day window, payment before invoice, multiple candidates to unresolved, no supplier to unresolved, NULL supplier_inn to unresolved. Use test fixtures with Supplier requisites with INN, Invoice, InvoiceItem, BankTransaction. Verify Invoice.status updates to Oplacheno on match. Verify TransactionMatchingAudit created with confidence_score.

## Inputs

- `backend/services/payment_matcher.py`
- `backend/tests/conftest.py`

## Expected Output

- `backend/tests/test_payment_matcher.py`

## Verification

pytest backend/tests/test_payment_matcher.py -v

## Observability Impact

N/A test code
