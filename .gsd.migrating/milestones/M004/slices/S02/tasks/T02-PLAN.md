---
estimated_steps: 27
estimated_files: 1
skills_used: []
---

# T02: Bank Statement Parser Tests

### Why
Ensure parser correctly handles both Tinkoff and Ozon formats, CP1251 Cyrillic text, field variations, and edge cases before S03 integration.

### Do
1. Create `backend/tests/test_bank_statement_parser.py` with test classes:
   - `TestCreateBankStatementParser`: Factory function tests
   - `TestBankStatementParserInit`: Initialization tests
   - `TestTinkoffFixtureParsing`: Tinkoff format parsing (3 transactions)
   - `TestOzonFixtureParsing`: Ozon format parsing (3 transactions, Получатель1 field)
   - `TestEncodingHandling`: CP1251 Cyrillic text handling
   - `TestFieldVariations`: ИНН vs 1 field name variations
   - `TestDateParsing`: DD.MM.YYYY format parsing
   - `TestAmountParsing`: Decimal with fractions (.75, .25)
   - `TestEdgeCases`: Empty lines, missing fields, empty file

2. Test both fixtures:
   - Verify 3 transactions each extracted correctly
   - Check amounts (150000.00, 85000.50, 250000.00 for Tinkoff)
   - Check INNs (ПолучательИНН for Tinkoff, Получатель1 for Ozon)
   - Check Cyrillic text (bank names, descriptions)

3. Follow test_invoice_parser.py patterns:
   - Class-based organization
   - Descriptive test method names
   - Mock where appropriate (not needed for actual file parsing)

### Done when
- `pytest backend/tests/test_bank_statement_parser.py -v` passes all tests
- Both fixtures parse with correct transaction counts (3 each)
- Amounts, dates, INNs match fixture values
- Cyrillic text renders correctly

## Inputs

- `backend/tests/test_invoice_parser.py`
- `backend/tests/fixtures/tinkoff_statement.txt`
- `backend/tests/fixtures/ozon_bank_statement.txt`
- `backend/services/bank_statement_parser.py`

## Expected Output

- `backend/tests/test_bank_statement_parser.py`

## Verification

pytest backend/tests/test_bank_statement_parser.py -v --tb=short

## Observability Impact

Tests verify parser correctness before S03 Email Worker integration
