# Bank Statement Test Fixtures

This directory contains sample bank statement files in 1C ClientBank format for testing the bank statement parser and auto-matching functionality.

## Files

### tinkoff_statement.txt
Sample bank statement export from Tinkoff Bank (ТИНЬКОФФ БАНК).

**Features:**
- 3 sample transactions ranging from 85,000 to 250,000 RUB
- Various supplier types (individual entrepreneur, LLC)
- Mixed INN formats (10-digit for individuals, 10-digit for organizations)
- Cyrillic payment descriptions with invoice references
- Typical Tinkoff field naming convention (`ПлательщикИНН`, `ПолучательИНН`)

**Transaction dates:** May 31 - June 2, 2026

### ozon_bank_statement.txt
Sample bank statement export from Ozon Bank (АО "ОЗОН БАНК").

**Features:**
- 3 sample transactions ranging from 67,500 to 125,000 RUB
- Different field naming convention (`Плательщик1` instead of `ПлательщикИНН`)
- Fractional amounts for testing precision (.75, .25)
- Ozon Bank BIC: 044525974
- Various payment purpose descriptions

**Transaction dates:** June 1-2, 2026

## 1C ClientBank Format

Both files follow the 1C ClientBank exchange format (Version 1.03) with:
- Windows encoding (CP1251)
- `СекцияДокумент` blocks for each transaction
- `КонецДокумент` markers
- `КонецФайла` at the end

## Usage

```python
from pathlib import Path

# Load fixture
fixture_path = Path(__file__).parent / "tinkoff_statement.txt"
with open(fixture_path, "r", encoding="cp1251") as f:
    content = f.read()

# Parse with BankStatementParser (to be implemented in S02)
# parser = BankStatementParser()
# transactions = parser.parse(content)
```

## Testing Notes

- These fixtures are designed for parser verification in S02
- Both files contain realistic Russian business scenarios
- Test for merged cell handling (common in Excel exports)
- Verify INN extraction and supplier matching logic
