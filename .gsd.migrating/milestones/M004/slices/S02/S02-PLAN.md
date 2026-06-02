# S02: 1C ClientBank Parser

**Goal:** Implement a 1C ClientBank format parser that extracts transaction data from Tinkoff and Ozon bank statement .txt files with CP1251 encoding support, handling field variations (ПолучательИНН vs Получатель1), and producing structured output compatible with BankStatement/BankTransaction ORM models.
**Demo:** Parser processes Tinkoff and Ozon .txt files, extracts СекцияДокумент transactions. Unit tests verify parsing of real bank statements with Russian content and merged lines.

## Must-Haves

- 1. Parser successfully extracts all transactions from both Tinkoff and Ozon fixtures (6 total)
- 2. Tinkoff fixture: 3 transactions with amounts 150000.00, 85000.50, 250000.00 and INNs from ПолучательИНН
- 3. Ozon fixture: 3 transactions with amounts 98000.75, 125000.00, 67500.25 and INNs from Получатель1
- 4. CP1251 Cyrillic text (bank names, payment descriptions) decoded correctly
- 5. Field variations handled: ПолучательИНН (Tinkoff) vs Получатель1 (Ozon)
- 6. Missing INN returns None (does not crash)
- 7. All tests pass with pytest
- 8. Parser output structure matches BankStatement/BankTransaction ORM model fields

## Proof Level

- This slice proves: Tests with real fixtures verify parser extracts correct amounts, dates, INNs, and Cyrillic text for both Tinkoff and Ozon formats

## Integration Closure

S02 unblocks S03 (Email Worker) which will call parse_bank_statement_file() in Celery task. S02 output structure maps directly to BankStatement/BankTransaction ORM fields from S01.

## Verification

- Parser logs encoding detected, transactions extracted count, field variations encountered, and any parsing errors. S03 Celery task will propagate these logs to FailedTask on retryable errors.

## Tasks

- [x] **T01: Bank Statement Parser Service** `est:2h`
  ### Why
  S03 (Email Worker) and S06 (Manual Upload) need a parser service to convert 1C ClientBank .txt files into structured data for persistence via BankStatement/BankTransaction models.
  - Files: `backend/services/bank_statement_parser.py`
  - Verify: python -c "from backend.services.bank_statement_parser import BankStatementParser, create_bank_statement_parser, parse_bank_statement_file; print('OK')"

- [ ] **T02: Bank Statement Parser Tests** `est:3h`
  ### Why
  Ensure parser correctly handles both Tinkoff and Ozon formats, CP1251 Cyrillic text, field variations, and edge cases before S03 integration.
  - Files: `backend/tests/test_bank_statement_parser.py`
  - Verify: pytest backend/tests/test_bank_statement_parser.py -v --tb=short

## Files Likely Touched

- backend/services/bank_statement_parser.py
- backend/tests/test_bank_statement_parser.py
