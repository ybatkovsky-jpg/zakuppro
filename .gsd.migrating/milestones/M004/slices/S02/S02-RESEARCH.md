# S02: 1C ClientBank Parser - Research

## Slice Context

**Milestone:** M004 (Bank Integration + Financials)
**Slice:** S02 (1C ClientBank Parser)
**Risk:** high
**Dependencies:** S01 (Database Schema + BankStatement Models)

**Goal:** Implement a parser that processes 1C ClientBank format .txt files from Russian banks (Tinkoff, Ozon), extracts transaction data, and prepares it for persistence via the BankStatement/BankTransaction ORM models.

## Requirements Analysis

### Active Requirements This Slice Supports

**R009** — Bank Worker для загрузки выписки (по API банка или через email) и мапинга платежей к счетам по ИНН и сумме
- **Class:** integration
- **Status:** active
- **Why:** Automatic payment matching to invoices by Supplier.INN + amount
- **Impact on S02:** Parser must extract supplier_inn and amount accurately

**R010** — UnresolvedTransaction таблица для платежей которые не удалось привязать автоматически
- **Class:** admin/support
- **Status:** active
- **Why:** Manual reconciliation for unmatched payments
- **Impact on S02:** Parser must preserve all transaction data even when fields are missing

## 1C ClientBank Format Analysis

### Format Specification

Based on test fixtures and research:

**File Structure:**
```
1CClientBankExchange         # File header
ВерсияФормата 1.03           # Format version
Кодировка Windows            # Encoding specification (CP1251)
СекцияДокумент              # Start of document section
НомерДокумента=456          # Document number
ДатаДокумента=02.06.2026    # Document date
ВидОперации=Покупка         # Operation type
Сумма=98000.75              # Amount
СуммаВал=98000.75           # Amount in currency
Валюта=810                  # Currency code (810 = RUB)
Плательщик=ООО "ЗакупПро"   # Payer name
ПлательщикИНН=7712345678   # Payer INN (Tinkoff format)
Плательщик1=7712345678      # Payer INN (Ozon format variation)
ПлательщикРасчСчет=...      # Payer account number
ПлательщикБИК=...           # Payer bank BIC
ПлательщикБанк1=...         # Payer bank name
Получатель=...              # Payee name
ПолучательИНН=...           # Payee INN (for supplier matching)
ПолучательРасчСчет=...      # Payee account
НазначениеПлатежа=...       # Payment description/purpose
ДатаСписания=...            # Debit date
ДатаПоступления=...         # Credit date
КонецДокумента              # End of document section
СекцияДокумент              # Next document...
...
КонецФайла                  # End of file marker
```

### Key Field Variations

**INN Field Naming:**
- Tinkoff: `ПлательщикИНН`, `ПолучательИНН`
- Ozon: `Плательщик1`, `Получатель1` (uses numeric suffix)

**Payment Purpose:**
- `НазначениеПлатежа` contains free-text description with invoice references, contract numbers, and VAT information

**Amounts:**
- Format: `Сумма=123456.78` (decimal with dot separator)
- Can include fractional values: `.75`, `.25`

### Encoding

**Windows-1251 (CP1251)** is the standard encoding for 1C ClientBank files from Russian banks. This must be handled correctly for Cyrillic text (bank names, payer/payee names, payment descriptions).

## Existing Codebase Patterns

### Parser Service Pattern

**Reference:** `backend/services/invoice_parser.py`

The codebase has an established pattern for parser services:
- Class-based parser (`InvoiceParser`)
- Factory function (`create_invoice_parser()`)
- Convenience function (`parse_invoice_file()`)
- Returns dict with `status: 'success'|'error'`
- Error handling with try-except and logging

### Model Mapping

**From S01:** BankStatement and BankTransaction models exist in `backend/models.py`

**BankTransaction fields to populate:**
- `transaction_date` → from `ДатаСписания` or `ДатаПоступления`
- `amount` → from `Сумма` (Numeric(12,2))
- `supplier_inn` → from `ПолучательИНН` or `Получатель1`
- `description` → from `НазначениеПлатежа`
- `operation_type` → from `ВидОперации` or derived

### Test Fixture Location

**Fixtures exist at:** `backend/tests/fixtures/`
- `tinkoff_statement.txt` (3 transactions)
- `ozon_bank_statement.txt` (3 transactions)
- `README.md` (documentation)

These fixtures provide real sample data for parser verification.

## Implementation Landscape

### Files to Create

1. **`backend/services/bank_statement_parser.py`**
   - `BankStatementParser` class
   - `parse()` method accepting file content
   - `parse_section()` method for СекцияДокумент blocks
   - Field extraction with variation handling
   - Returns structured dict with statement + transactions

2. **`backend/tests/test_bank_statement_parser.py`**
   - Test class `TestBankStatementParser`
   - Tests for both Tinkoff and Ozon fixtures
   - Encoding tests (CP1251)
   - Field variation tests (ИНН vs 1)
   - Edge case tests (empty lines, merged fields)

3. **`backend/schemas/bank_statement.py`** (optional)
   - Pydantic models for parser output
   - `BankStatementData` with transactions list
   - Use `model_config = ConfigDict(from_attributes=True)` (MEM002)

### Parser Design

**Recommended Approach:**

```python
class BankStatementParser:
    def parse(self, content: bytes) -> dict:
        """Parse 1C ClientBank format file content.
        
        Args:
            content: Raw file bytes (will decode as CP1251)
        
        Returns:
            dict with:
                - bank_name: str
                - statement_date: datetime
                - period_start: datetime
                - period_end: datetime
                - transactions: List[dict]
        """
```

**Key Parsing Logic:**
1. Decode content as `cp1251` with fallback to `utf-8`
2. Split by lines
3. Detect `СекцияДокумент` sections
4. Extract key-value pairs within each section
5. Handle field variations (`ПолучательИНН` vs `Получатель1`)
6. Parse dates (DD.MM.YYYY format)
7. Parse amounts (decimal with dot separator)
8. Stop at `КонецФайла`

### Field Mapping Strategy

**BankStatement-level fields:**
- Bank name → extract from `ПлательщикБанк1` or `ПолучательБанк1`
- Statement date → from first `ДатаДокумента`
- Period → min/max of all `ДатаДокумента`

**BankTransaction fields:**
- `transaction_date` → `ДатаСписания` or `ДатаПоступления`
- `amount` → `Сумма` parsed as Decimal
- `supplier_inn` → `ПолучательИНН` or `Получатель1`
- `description` → `НазначениеПлатежа`
- `operation_type` → `ВидОперации` or default "Покупка"

### Dependencies

**Python standard library:**
- `codecs` for encoding handling
- `datetime` for date parsing
- `decimal` for amount precision

**No external libraries required** — 1C ClientBank is a simple key-value format.

## Risks and Unknowns

### High Risk Areas

1. **Encoding Issues**
   - Risk: Files may not be CP1251 (UTF-8, CP866)
   - Mitigation: Try CP1251 first, fallback to UTF-8, log encoding used

2. **Field Name Variations**
   - Risk: Banks may use non-standard field names
   - Risk: `ПолучательИНН` vs `Получатель1` vs other variants
   - Mitigation: Support known variations, log unknown fields

3. **Date Format Variations**
   - Risk: Date formats may vary (DD.MM.YYYY vs YYYY-MM-DD)
   - Mitigation: Support both formats with try-except

4. **Merged/Continuation Lines**
   - Risk: Long payment purposes may wrap to next line
   - Risk: Excel exports may have merged cells
   - Mitigation: Detect continuation lines (no "=" in line)

5. **Missing INN**
   - Risk: Some transactions lack `ПолучательИНН` field
   - Impact: Cannot auto-match, will create UnresolvedTransaction
   - Mitigation: Allow None for supplier_inn

### Medium Risk Areas

1. **Amount Precision**
   - Risk: Decimal handling for very small/large amounts
   - Mitigation: Use Python Decimal with quantize

2. **Transaction Count**
   - Risk: Large statements (1000+ transactions)
   - Mitigation: Process incrementally, no memory issues expected

## Implementation Notes

### Don't Hand-Roll

**Odoo Reference:** [odoo-ru/client-bank-1c](https://github.com/odoo-ru/client-bank-1c)
- Open-source Python implementation for reference
- Not directly reusable (Odoo-specific)
- Useful for understanding edge cases

**No PyPI Libraries Found:** No standalone 1C ClientBank parser package exists on PyPI. Must implement custom parser.

### Testing Strategy

**Required Test Coverage:**
1. Tinkoff fixture parsing (3 transactions)
2. Ozon fixture parsing (3 transactions)
3. Field variation handling (`ИНН` vs `1`)
4. Encoding handling (CP1251 Cyrillic)
5. Date parsing (DD.MM.YYYY)
6. Amount parsing (decimal with fractions)
7. Empty/whitespace handling
8. Missing field handling

**Verification Command:**
```bash
pytest backend/tests/test_bank_statement_parser.py -v
```

## Sources

- [Odoo Russia - client-bank-1c Repository](https://github.com/odoo-ru/client-bank-1c) - Python implementation reference
- [1C ClientBank Exchange Documentation](https://its.1c.ru/db/metod8dev/content/3262/hdoc) - Official format specification
- [1C Exchange Standard](https://v8.1c.ru/tekhnologii/obmen-dannymi-i-integratsiya/standarty-i-formaty/standart-obmena-s-sistemami-klient-banka/) - Official standard
- [bankstatementparser on PyPI](https://pypi.org/project/bankstatementparser/) - General bank statement parsing (not 1C-specific)
- [Microsoft Dynamics Russia Client-Bank](https://learn.microsoft.com/en-us/dynamics365/finance/localizations/russia/rus-client-bank-export) - Bank reconciliation reference

## Summary and Recommendation

**Depth:** Targeted research — 1C ClientBank is a simple key-value format with known structure. The test fixtures provide real sample data. No external libraries required.

**Implementation Approach:**
1. Create `BankStatementParser` class in `backend/services/bank_statement_parser.py`
2. Implement CP1251 decoding with UTF-8 fallback
3. Parse СекцияДокумент sections line-by-line
4. Extract fields with variation handling (`ИНН` vs `1`)
5. Return structured dict compatible with BankStatement/BankTransaction models
6. Write comprehensive tests with both fixtures

**Verification:**
- Parse both Tinkoff and Ozon fixtures correctly
- Extract all transactions with correct amounts, dates, INNs
- Handle Cyrillic text (bank names, descriptions)
- Return structure ready for ORM model creation

**Next Step:** Planner should decompose this into tasks for executor implementation.