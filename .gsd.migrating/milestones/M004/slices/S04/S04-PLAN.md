# S04: Auto-Matching Service

**Goal:** Create PaymentMatcher service that auto-matches BankTransactions to Invoices by Supplier.INN (from requisites text field), amount 5%, and date proximity, creating Payment records on match or UnresolvedTransaction on failure
**Demo:** Auto-matcher links BankTransactions to Invoices by supplier INN + amount ±5% + date range. Unmatched transactions go to UnresolvedTransaction. Unit tests verify matching logic.

## Must-Haves

- PaymentMatcher matches BankTransactions to Invoices by Supplier.INN (from requisites text), amount +/-5%, and date proximity (payment within 90 days of invoice)
- Exact INN + amount match creates Payment with confidence 1.00 and updates Invoice.status to Oplacheno
- Amount within +/-5% tolerance creates Payment with confidence 0.85-0.99
- No match (supplier not found, amount mismatch, multiple candidates) creates UnresolvedTransaction with status Ne raspredeleno
- TransactionMatchingAudit records created with confidence_score and matching_context JSON metadata
- match_bank_transactions Celery task processes statements asynchronously with retry/backoff
- Unit tests verify INN extraction variants, amount tolerance, date proximity, and matching logic
- Integration tests verify end-to-end flow from BankTransaction to Payment/UnresolvedTransaction

## Proof Level

- This slice proves: integration

## Integration Closure

Upstream surfaces consumed: BankStatement/BankTransaction from S03 parse_bank_statement task, Invoice/PurchaseOrder/Supplier models from M003, Supplier.requisites text field for INN extraction. New wiring introduced: PaymentMatcher service, match_bank_transactions Celery task, Payment and TransactionMatchingAudit creation, UnresolvedTransaction creation. What remains before milestone is truly usable end-to-end: S05 Transaction Matching API provides endpoints for manual reconciliation, S06 Analytics Export Manual Upload provides dashboard and manual upload fallback

## Verification

- Runtime signals: Logger statements for each matching stage INN extraction, invoice lookup, tolerance checks, payment creation, unresolved creation, stats tracking matched_count, unresolved_count. Inspection surfaces: Payment records query by invoice_id, TransactionMatchingAudit records confidence_score, matching_context JSON, UnresolvedTransaction table manual review queue, Invoice.status equals Oplacheno for paid invoices. Failure visibility: FailedTask DLQ records on parse errors, UnresolvedTransaction records with reason field, TransactionMatchingAudit.matching_context contains algorithm metadata for debugging. Redaction constraints: None no PII in matching context beyond existing Supplier.requisites

## Tasks

- [x] **T01: Create Supplier INN Extractor Service** `est:30m`
  Create supplier_inn_extractor.py with extract_inn_from_requisites function to parse INN from Supplier.requisites text field. Handle multiple formats including INN colon number, INN space number, inn colon number. Return None if not found. Add comprehensive unit tests for various requisites formats including edge cases missing INN, malformed, uppercase lowercase variants.
  - Files: `backend/services/supplier_inn_extractor.py`, `backend/tests/test_supplier_inn_extractor.py`
  - Verify: pytest backend/tests/test_supplier_inn_extractor.py -v

- [x] **T02: Create Payment Matcher Core Service** `est:2h`
  Create payment_matcher.py with PaymentMatcher class following InvoiceVerifier pattern. Implement multi tier matching exact INN plus amount to confidence 1.00, INN plus amount plus minus 5 percent to confidence 0.85 to 0.99. Include private methods for INN extraction, invoice lookup, tolerance checks. Handle edge cases NULL supplier_inn, no invoices, multiple candidates to unresolved. Build Supplier INN lookup cache to avoid repeated text extraction. Query invoices via PurchaseOrder with status in Sveren Ozhidaet oplaty. Return MatchResult dict with matched_count, unresolved_count, payment_ids.
  - Files: `backend/services/payment_matcher.py`
  - Verify: python -c from backend.services.payment_matcher import PaymentMatcher; print OK

- [ ] **T03: Add Payment and UnresolvedTransaction Creation to Matcher** `est:1.5h`
  Extend PaymentMatcher with _create_payment_record and _create_unresolved_transaction methods. _create_payment_record creates Payment with invoice_id, amount, bank_transaction_id as string, payment_date and TransactionMatchingAudit with confidence_score and matching_context JSON. _create_unresolved_transaction creates UnresolvedTransaction with amount, description, bank_date, status equals Ne raspredeleno. Update Invoice.status to Oplacheno on successful match. Add methods to call create_payment on match, create_unresolved on failure. Commit DB changes after each transaction processed.
  - Files: `backend/services/payment_matcher.py`
  - Verify: pytest backend/tests/test_payment_matcher.py -v -k test_create_payment or test_create_unresolved

- [ ] **T04: Create Celery Task for Payment Matching** `est:1h`
  Add match_bank_transactions task to tasks.py following parse_bank_statement pattern. Task takes bank_statement_id or bank_transaction_id, calls PaymentMatcher, returns dict with status, matched_count, unresolved_count, payment_ids. Include bind equals True, max_retries equals 2, exponential backoff on RateLimitError, FailedTask DLQ on final failure. Add logger statements for each stage.
  - Files: `backend/tasks.py`, `backend/tests/test_match_bank_transactions_task.py`
  - Verify: pytest backend/tests/test_match_bank_transactions_task.py -v

- [ ] **T05: Create Unit Tests for Payment Matcher** `est:2h`
  Create test_payment_matcher.py with comprehensive unit tests covering exact INN plus amount match to confidence 1.00, amount within plus minus 5 percent tolerance, amount outside tolerance, payment within 90 day window, payment before invoice, multiple candidates to unresolved, no supplier to unresolved, NULL supplier_inn to unresolved. Use test fixtures with Supplier requisites with INN, Invoice, InvoiceItem, BankTransaction. Verify Invoice.status updates to Oplacheno on match. Verify TransactionMatchingAudit created with confidence_score.
  - Files: `backend/tests/test_payment_matcher.py`
  - Verify: pytest backend/tests/test_payment_matcher.py -v

- [ ] **T06: Create Integration Tests for End-to-End Matching Flow** `est:2h`
  Create test_matching_integration.py with end to end tests BankStatement to BankTransaction to Payment matching, UnresolvedTransaction creation verification, Invoice.status update verification, TransactionMatchingAudit record verification, Celery task execution via helper function. Test scenarios simple exact match, tolerance match, ambiguous to unresolved, unknown supplier to unresolved. Add call_match_bank_transactions_task_helper bypassing Celery. Verify confidence_score populated in TransactionMatchingAudit. Verify matching_context JSON contains algorithm metadata.
  - Files: `backend/tests/test_matching_integration.py`
  - Verify: pytest backend/tests/test_matching_integration.py -v

## Files Likely Touched

- backend/services/supplier_inn_extractor.py
- backend/tests/test_supplier_inn_extractor.py
- backend/services/payment_matcher.py
- backend/tasks.py
- backend/tests/test_match_bank_transactions_task.py
- backend/tests/test_payment_matcher.py
- backend/tests/test_matching_integration.py
