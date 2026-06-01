---
estimated_steps: 21
estimated_files: 1
skills_used: []
---

# T06: Write End-to-End Integration Test

## Why
Verification of the complete flow (R004, R005) requires an integration test that exercises Excel upload through database creation to Telegram notification.

## Do
1. Create `backend/tests/test_s04_integration.py`:
2. Test cases:
   - `test_failed_task_model_exists`: Verify FailedTask can be imported and instantiated
   - `test_supplier_resolver`: Test find_or_create_supplier with new and existing names
   - `test_process_bom_to_project_task`: Full flow with test Excel file
     - Use fixtures/sample_bom.xlsx from S03
     - Mock Telegram Bot to avoid API calls
     - Verify Project created with expected name/client
     - Verify ProjectItem records with correct counts
     - Verify supplier resolution
   - `test_dlq_persistence`: Trigger error and verify FailedTask record
3. Use pytest fixtures for database session (rollback after test)
4. Mock external dependencies (OpenAI, Telegram Bot)
5. Assert database state matches expected outcomes

## Done when
- All tests pass
- Database operations verified
- Error path coverage confirmed

## Inputs

- `backend/tasks.py`
- `backend/models.py`
- `backend/supplier_resolver.py`
- `backend/tests/test_s03_integration.py`
- `tests/fixtures/sample_bom.xlsx`

## Expected Output

- `backend/tests/test_s04_integration.py`

## Verification

python -m pytest backend/tests/test_s04_integration.py -v
