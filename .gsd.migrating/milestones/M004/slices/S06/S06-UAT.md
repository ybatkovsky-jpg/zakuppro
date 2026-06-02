# S06: Analytics + Export + Manual Upload — UAT

**Milestone:** M004
**Written:** 2026-06-02T21:58:35.235Z

# S06 User Acceptance Tests

## UAT-1: Dashboard Metrics Display

**Preconditions:**
- System has invoices with various statuses (paid, unpaid, pending)
- At least one payment exists linked to a paid invoice
- User has access to analytics endpoints

**Steps:**
1. Call GET /api/analytics/dashboard without date parameters
2. Verify response includes all required fields:
   - paid_invoices_count (integer)
   - unpaid_invoices_count (integer)
   - total_paid_amount (decimal)
   - total_unpaid_amount (decimal)
   - pending_invoices_count (integer)
   - period_start (datetime)
   - period_end (datetime)
3. Verify default date range is last 30 days
4. Call GET /api/analytics/dashboard with period_start and period_end parameters
5. Verify returned counts match invoices within specified date range

**Expected Outcomes:**
- Response returns 200 OK
- All required fields present with correct data types
- Counts accurately reflect invoice statuses in database
- Amounts correctly sum payment and invoice totals
- Default date range covers last 30 days from today

**Edge Cases:**
- Empty database returns zero counts and zero amounts
- Date range exceeding 1 year returns 400 Bad Request
- period_start >= period_end returns 400 Bad Request
- Only one of period_start/period_end provided returns 400 Bad Request

**UAT Type:** Functional

**Not Proven By This UAT:**
- Frontend visualization of metrics
- Real-time updates via WebSocket/polling

---

## UAT-2: Payment Dynamics Time-Series

**Preconditions:**
- System has payments across multiple days
- At least one payment exists

**Steps:**
1. Call GET /api/analytics/payment-dynamics without date parameters
2. Verify response structure:
   - period_start (datetime)
   - period_end (datetime)
   - group_by (string: "day", "week", or "month")
   - data (array of PaymentDynamicsPoint with date, total_amount, count)
3. Verify data points are grouped by day (default)
4. Call GET /api/analytics/payment-dynamics with group_by=week
5. Verify data points are grouped by week
6. Call with custom date range parameters
7. Verify only payments within date range are included

**Expected Outcomes:**
- Response returns 200 OK
- Data points sorted chronologically
- Each group's total_amount sums correctly
- Each group's count reflects number of payments in that period
- No overlapping data points between groups
- group_by=month generates correct monthly aggregations

**Edge Cases:**
- Empty database returns empty data array
- Date range exceeding 1 year returns 400 Bad Request
- Invalid group_by value returns 400 Bad Request

**UAT Type:** Functional

**Not Proven By This UAT:**
- Frontend chart rendering
- Performance with large payment datasets (>10,000 records)

---

## UAT-3: Excel Export Download

**Preconditions:**
- System has payments with nested relationships (supplier, project, invoice)

**Steps:**
1. Call GET /api/analytics/export/transactions
2. Verify response headers:
   - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   - Content-Disposition includes filename with .xlsx extension
3. Download and open the Excel file
4. Verify columns exist: date, amount, invoice_id, supplier, project, description
5. Verify row count matches number of payments in database
6. Verify data accuracy (amounts, dates, foreign keys)
7. Call with date_from and date_to parameters
8. Verify exported data is filtered to date range

**Expected Outcomes:**
- Response returns 200 OK
- File downloads successfully as valid .xlsx
- All required columns present
- Data integrity maintained (no missing relationships)
- Date filtering works correctly
- Limit parameter (max 1000) is respected

**Edge Cases:**
- Empty database returns valid Excel with headers only
- Limit exceeds 1000 returns 400 Bad Request
- Large datasets (>1000 rows) are truncated correctly

**UAT Type:** Functional + Data Integrity

**Not Proven By This UAT:**
- Excel file format compatibility with specific Excel versions
- Performance with large export operations

---

## UAT-4: Manual Bank Statement Upload

**Preconditions:**
- User has a valid 1C ClientBank .txt file from Tinkoff or Ozon Bank
- File is smaller than 5MB
- File uses CP1251 or UTF-8 encoding

**Steps:**
1. Call POST /api/analytics/upload-bank-statement with .txt file
2. Verify response structure:
   - statement_id (integer)
   - transactions_count (integer)
   - payments_created (integer)
   - unresolved_created (integer)
3. Query database for BankStatement record
4. Verify BankStatement has correct file_date and parsing metadata
5. Query BankTransaction records linked to statement
6. Verify transaction data (INN, amount, date, description)
7. If matching invoices exist, verify Payment records created
8. If no match found, verify UnresolvedTransaction records created
9. Call with non-.txt file (e.g., .pdf)
10. Verify 400 Bad Request with extension validation error
11. Call with file exceeding 5MB
12. Verify 400 Bad Request with size validation error

**Expected Outcomes:**
- Valid .txt file returns 201 Created
- BankStatement and BankTransaction records persist correctly
- Parser extracts transactions from 1C ClientBank format
- Auto-matching links transactions to invoices by INN + amount ±5% + date range
- Unmatched transactions create UnresolvedTransaction records
- Extension validation rejects non-.txt files
- Size validation rejects files exceeding 5MB
- Response accurately reports counts of created records

**Edge Cases:**
- Empty file returns 201 with 0 transactions (not 400)
- Invalid format returns 201 with 0 transactions
- Corrupted encoding returns 201 with 0 transactions
- Multiple transactions from same statement processed correctly

**UAT Type:** Functional + Data Integrity + Integration

**Not Proven By This UAT:**
- Frontend upload UI usability
- Handling of malicious file content
- Processing of bank statement formats other than Tinkoff/Ozon 1C ClientBank

---

## UAT-5: End-to-End Workflow Integration

**Preconditions:**
- System has suppliers with INNs
- System has invoices linked to suppliers
- User has a bank statement with matching transactions

**Steps:**
1. Create supplier with INN=123456789012
2. Create invoice for supplier with amount=150000.00
3. Upload bank statement .txt file with 3 transactions (one matching invoice)
4. Verify dashboard metrics show updated paid count
5. Verify payment dynamics includes new payment
6. Export transactions to Excel
7. Verify exported file includes new payment
8. Query TransactionMatchingAudit for match record
9. Verify audit record has confidence_score and matching_context

**Expected Outcomes:**
- Upload triggers parsing, matching, and audit trail creation
- Dashboard metrics reflect new payment within 1 second
- Payment dynamics includes new payment in correct time bucket
- Excel export includes new payment with all relationships
- TransactionMatchingAudit record created with proper metadata
- No data inconsistencies across endpoints

**UAT Type:** Integration

**Not Proven By This UAT:**
- Concurrent upload handling
- Transaction rollback on partial failure
- Performance under high concurrency
