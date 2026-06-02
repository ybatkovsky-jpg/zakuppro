---
estimated_steps: 27
estimated_files: 4
skills_used: []
---

# T03: Implement manual bank statement upload endpoint with validation and parser integration

## Why
Manual upload provides fallback when email Worker fails or for ad-hoc bank statement uploads outside the automated email flow.

## Do
1. Extend `backend/routers/analytics.py` with:
   - POST /api/analytics/upload-bank-statement
   - Accept UploadFile type parameter
   - Validate file extension (.txt only, case-insensitive)
   - Validate file size (max 5MB)
   - Read content with await file.read()
   - Call BankStatementParser.parse(content)
   - Create BankStatement record with bank_name, statement_date, period_start/end
   - Create BankTransaction records for each parsed transaction
   - Optionally call PaymentMatcher.match_statement_transactions() for auto-matching
   - Return {parsed_transactions: int, bank_statement_id: int, matched_count: int}
   - Log file name, size, parse result
2. Create UploadBankStatementResponse schema
3. Add schema to `backend/schemas/__init__.py`
4. Create unit tests in `backend/tests/test_api/test_analytics.py`:
   - Test valid .txt upload with real bank statement content
   - Test invalid extension rejection (400)
   - Test file size limit (5MB)
   - Test parser error handling

## Done when
- POST /api/analytics/upload-bank-statement accepts .txt files
- Creates BankStatement + BankTransaction records
- Returns parsed transaction count
- Tests cover valid upload, invalid extension, size limit, parser errors

## Inputs

- `backend/routers/analytics.py`
- `backend/schemas.py`
- `backend/schemas/__init__.py`
- `backend/services/bank_statement_parser.py`
- `backend/services/payment_matcher.py`
- `backend/models.py`
- `backend/handlers/documents.py`
- `backend/tests/test_api/test_analytics.py`

## Expected Output

- `backend/routers/analytics.py`
- `backend/tests/test_api/test_analytics.py`

## Verification

pytest backend/tests/test_api/test_analytics.py -v -k upload

## Observability Impact

Upload endpoint logs file name, size, parse result (transaction count, bank name), and any errors for debugging.
