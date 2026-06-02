---
estimated_steps: 10
estimated_files: 1
skills_used: []
---

# T04: Run all S06 tests and verify coverage threshold

## Why
Slice completeness requires all new tests passing with >80% coverage. Confirms S06 validates integration closure.

## Do
1. Run full S06 test suite: `pytest backend/tests/test_s06_e2e_integration.py -v --cov=backend.tasks --cov=backend.services.invoice_parser --cov=backend.services.invoice_verifier --cov-report=term-missing`
2. Verify all tests pass (T01-T03 tests)
3. Verify coverage >80% for new test file
4. Run regression tests: `pytest backend/tests/test_s03_integration.py backend/tests/test_s04_integration.py backend/tests/test_s05_notifications_integration.py -v` to confirm S06 didn't break dependencies
5. Document test count and coverage in S06-SUMMARY.md (executor will write this during completion)

## Done when
All S06 tests pass, coverage >80%, regression tests pass.

## Inputs

- `backend/tests/test_s06_e2e_integration.py`
- `backend/tests/test_s03_integration.py`
- `backend/tests/test_s04_integration.py`
- `backend/tests/test_s05_notifications_integration.py`

## Expected Output

- `backend/tests/test_s06_e2e_integration.py`

## Verification

cd backend && python -m pytest tests/test_s06_e2e_integration.py -v --cov=backend.tests.test_s06_e2e_integration --cov-report=term-missing

## Observability Impact

Verification confirms integration test coverage and pipeline validation
