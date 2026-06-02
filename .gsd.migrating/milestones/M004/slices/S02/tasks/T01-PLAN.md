---
estimated_steps: 39
estimated_files: 1
skills_used: []
---

# T01: Bank Statement Parser Service

### Why
S03 (Email Worker) and S06 (Manual Upload) need a parser service to convert 1C ClientBank .txt files into structured data for persistence via BankStatement/BankTransaction models.

### Do
1. Create `backend/services/bank_statement_parser.py` with:
   - `BankStatementParser` class following invoice_parser.py pattern
   - `parse(content: bytes) -> dict` method as main entry point
   - `parse_section(section_lines: List[str]) -> dict` for СекцияДокумент blocks
   - Field extraction with variation handling (`ПолучательИНН` vs `Получатель1`)
   - Date parsing (DD.MM.YYYY format)
   - Amount parsing (decimal with dot separator)
   - CP1251 decoding with UTF-8 fallback

2. Return structure:
   ```python
   {
       'bank_name': str,
       'statement_date': datetime,
       'period_start': datetime,
       'period_end': datetime,
       'transactions': [
           {
               'transaction_date': datetime,
               'amount': Decimal,
               'supplier_inn': str | None,
               'description': str,
               'operation_type': str
           },
           ...
       ]
   }
   ```

3. Handle edge cases:
   - Empty lines and whitespace
   - Missing INN field (returns None for supplier_inn)
   - Encoding fallback (CP1251 → UTF-8)
   - Stop at `КонецФайла`

### Done when
- `from backend.services.bank_statement_parser import BankStatementParser, create_bank_statement_parser, parse_bank_statement_file` works
- Parser returns expected structure with bank_name, dates, and transactions list
- All fields from fixtures are extracted correctly

## Inputs

- `backend/services/invoice_parser.py`
- `backend/tests/fixtures/tinkoff_statement.txt`
- `backend/tests/fixtures/ozon_bank_statement.txt`

## Expected Output

- `backend/services/bank_statement_parser.py`

## Verification

python -c "from backend.services.bank_statement_parser import BankStatementParser, create_bank_statement_parser, parse_bank_statement_file; print('OK')"

## Observability Impact

Parser logs encoding used, number of transactions extracted, and any field variations encountered
