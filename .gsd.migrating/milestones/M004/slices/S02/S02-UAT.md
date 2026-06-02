# S02: 1C ClientBank Parser — UAT

**Milestone:** M004
**Written:** 2026-06-02T08:53:47.193Z

# S02-UAT: 1C ClientBank Parser

## UAT Type
Component Unit Testing (Real Fixtures)

## Preconditions
- Python 3.12+ environment
- pytest installed
- Test fixtures at `backend/tests/fixtures/tinkoff_statement.txt` and `backend/tests/fixtures/ozon_bank_statement.txt`

## Test Cases

### TC1: Tinkoff Statement Parsing
**Steps:**
1. Load `tinkoff_statement.txt` fixture
2. Call `parse_bank_statement_file(content)`
3. Verify results

**Expected Outcomes:**
- 3 transactions extracted
- Amounts: 150000.00, 85000.50, 250000.00
- Bank name: ТИНЬКОФФ БАНК
- INN field variation: ПолучательИНН
- Supplier INNs: 123456789012, 9876543210, 7701234567
- Date range: 31.05.2026 - 02.06.2026
- Cyrillic descriptions render correctly

**Result:** PASS (11 tests verify)

### TC2: Ozon Statement Parsing
**Steps:**
1. Load `ozon_bank_statement.txt` fixture
2. Call `parse_bank_statement_file(content)`
3. Verify results

**Expected Outcomes:**
- 3 transactions extracted
- Amounts: 98000.75, 125000.00, 67500.25
- Bank name: АО "ОЗОН БАНК"
- INN field variation: Получатель1
- Supplier INNs: 3210987654, 6543210987, 987654321098
- Cyrillic descriptions render correctly

**Result:** PASS (8 tests verify)

### TC3: Encoding Handling
**Steps:**
1. Parse file with Cyrillic И (byte 0x98 invalid in CP1251)
2. Verify encoding detection

**Expected Outcomes:**
- CP1251 attempted first
- UTF-8 fallback triggered
- Text renders correctly

**Result:** PASS (4 tests verify)

### TC4: Edge Cases
**Steps:**
1. Parse empty file
2. Parse file with only headers
3. Parse file with malformed lines

**Expected Outcomes:**
- Empty transaction list returned
- No crashes
- Malformed lines skipped

**Result:** PASS (6 tests verify)

### TC5: ORM Structure Compatibility
**Steps:**
1. Examine transaction output structure
2. Compare to BankStatement/BankTransaction models

**Expected Outcomes:**
- transaction_date: datetime
- amount: Decimal
- supplier_inn: str|None
- description: str
- operation_type: str

**Result:** PASS (Structure matches S01 ORM models)

## Not Proven By This UAT
- S03 integration: Email Worker calling parser via Celery task
- S06 integration: Manual upload endpoint calling parser
- Performance with large statement files (>1000 transactions)
