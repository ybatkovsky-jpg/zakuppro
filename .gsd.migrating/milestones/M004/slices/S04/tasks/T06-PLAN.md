---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T06: Create Integration Tests for End-to-End Matching Flow

Create test_matching_integration.py with end to end tests BankStatement to BankTransaction to Payment matching, UnresolvedTransaction creation verification, Invoice.status update verification, TransactionMatchingAudit record verification, Celery task execution via helper function. Test scenarios simple exact match, tolerance match, ambiguous to unresolved, unknown supplier to unresolved. Add call_match_bank_transactions_task_helper bypassing Celery. Verify confidence_score populated in TransactionMatchingAudit. Verify matching_context JSON contains algorithm metadata.

## Inputs

- `backend/services/payment_matcher.py`
- `backend/tests/test_bank_statement_integration.py`
- `backend/tasks.py`

## Expected Output

- `backend/tests/test_matching_integration.py`

## Verification

pytest backend/tests/test_matching_integration.py -v

## Observability Impact

N/A test code
