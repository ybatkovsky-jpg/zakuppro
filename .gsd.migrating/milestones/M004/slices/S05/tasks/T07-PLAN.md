---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T07: Write Integration Test for Manual Matching Workflow

Create backend/tests/test_unresolved_matching_integration.py testing end-to-end workflow: create UnresolvedTransaction → get candidates → single manual match → verify Payment created → verify TransactionMatchingAudit with matched_by='manual' → verify UnresolvedTransaction.status updated → bulk match multiple transactions → audit history retrieval. Use db_session fixture with real models.

## Inputs

- `backend/tests/conftest.py`
- `backend/models.py`
- `backend/services/payment_matcher.py`

## Expected Output

- `backend/tests/test_unresolved_matching_integration.py`

## Verification

pytest backend/tests/test_unresolved_matching_integration.py -v
