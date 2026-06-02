---
estimated_steps: 16
estimated_files: 1
skills_used: []
---

# T05: Write integration test for end-to-end bank statement flow

## Why
Verify the complete flow: IMAP receives email with .txt attachment → Email Worker routes to parse_bank_statement → Task processes → Data persisted to DB.

## Do
1. Create `backend/tests/test_bank_statement_integration.py`
2. Test steps:
   - Mock IMAP email with Tinkoff/Ozon .txt fixture attachment
   - Call parse_bank_statement task directly with fixture content
   - Verify BankStatement record created with correct fields
   - Verify BankTransaction records count matches fixture (3 transactions)
   - Verify amounts, INNs, descriptions parsed correctly
   - Verify BankStatement.status = 'Готов'
3. Use pytest fixtures from `conftest.py` for DB session

## Done when
- Integration test file created
- Test passes with Tinkoff fixture (3 transactions)
- Test passes with Ozon fixture (3 transactions)

## Inputs

- `backend/tests/fixtures/tinkoff_statement.txt`
- `backend/tests/fixtures/ozon_bank_statement.txt`
- `backend/tests/conftest.py`

## Expected Output

- `backend/tests/test_bank_statement_integration.py`

## Verification

pytest backend/tests/test_bank_statement_integration.py -v --tb=short
