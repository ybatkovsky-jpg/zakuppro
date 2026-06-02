---
estimated_steps: 13
estimated_files: 3
skills_used: []
---

# T03: Add Tinkoff and Ozon Bank 1C ClientBank test fixtures

## Why
Provides real-world sample data for S02 parser verification. Russian bank format testing ensures parser handles merged cells and Cyrillic content correctly.

## Do
1. Create backend/tests/fixtures/tinkoff_statement.txt with 1C ClientBank format:
   - СекцияДокумент header with Russian field names
   - Sample transactions with СекцияДокумент.Об픽 blocks
   - Include merged line patterns (common in Tinkoff exports)
2. Create backend/tests/fixtures/ozon_bank_statement.txt with Ozon Bank format variation
3. Add README.md in fixtures directory explaining each fixture's purpose

## Done when
- tinkoff_statement.txt exists with valid 1C ClientBank СекцияДокумент structure
- ozon_bank_statement.txt exists with Ozon Bank variation
- README.md documents fixture usage

## Inputs

- None specified.

## Expected Output

- `backend/tests/fixtures/tinkoff_statement.txt`
- `backend/tests/fixtures/ozon_bank_statement.txt`
- `backend/tests/fixtures/README.md`

## Verification

test -f backend/tests/fixtures/tinkoff_statement.txt && test -f backend/tests/fixtures/ozon_bank_statement.txt && grep -q 'СекцияДокумент' backend/tests/fixtures/tinkoff_statement.txt
