---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T03: Add Payment and UnresolvedTransaction Creation to Matcher

Extend PaymentMatcher with _create_payment_record and _create_unresolved_transaction methods. _create_payment_record creates Payment with invoice_id, amount, bank_transaction_id as string, payment_date and TransactionMatchingAudit with confidence_score and matching_context JSON. _create_unresolved_transaction creates UnresolvedTransaction with amount, description, bank_date, status equals Ne raspredeleno. Update Invoice.status to Oplacheno on successful match. Add methods to call create_payment on match, create_unresolved on failure. Commit DB changes after each transaction processed.

## Inputs

- `backend/services/payment_matcher.py`
- `backend/models.py`

## Expected Output

- `backend/services/payment_matcher.py`

## Verification

pytest backend/tests/test_payment_matcher.py -v -k test_create_payment or test_create_unresolved

## Observability Impact

Logger statements for Payment UnresolvedTransaction creation with record IDs, confidence scores
