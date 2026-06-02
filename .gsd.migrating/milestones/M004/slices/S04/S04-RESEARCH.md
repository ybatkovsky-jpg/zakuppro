# S04: Auto-Matching Service - Research

**Slice:** Auto-Matching Service (S04 - M004)
**Type:** Targeted research (known pattern: InvoiceVerifier provides template, but INN extraction needs investigation)
**Date:** 2026-06-02

## Summary

The Auto-Matching Service must link `BankTransaction` records to `Invoice` records using three matching criteria: Supplier.INN (primary), amount ±5% tolerance, and date proximity. When automatic matching fails, transactions go to `UnresolvedTransaction` for manual reconciliation. The research reveals **one critical schema issue**: Supplier.INN is stored in a `requisites` Text field, not a dedicated column, requiring text extraction logic.

## Existing Models and Relationships

```
BankStatement (1) → (N) BankTransaction
BankTransaction (N) ← (N) TransactionMatchingAudit ← (1) Invoice
Invoice (N) ← (1) PurchaseOrder ← (1) Supplier
Supplier.requisites: Text field containing "ИНН: 7701234567, БИК: 044525225, ..."
```

### Key Fields for Matching

| Model | Field | Type | Indexed | Purpose |
|-------|-------|------|---------|---------|
| `BankTransaction` | `supplier_inn` | String(12) | ✅ | Parsed from 1C ClientBank ПолучательИНН |
| `BankTransaction` | `amount` | Numeric(12,2) | ✅ | Payment amount |
| `BankTransaction` | `transaction_date` | DateTime | ✅ | Payment date |
| `Invoice` | `status` | String(50) | ❌ | Target: "Оплачен" after match |
| `InvoiceItem` | `total_price` | Numeric(12,2) | ❌ | Line item total (qty × unit_price) |
| `Supplier` | `requisites` | Text | ❌ | **INN embedded as text** |
| `TransactionMatchingAudit` | `confidence_score` | Numeric(3,2) | ❌ | 0.00-1.00 for match confidence |
| `TransactionMatchingAudit` | `matching_context` | JSON | ❌ | Algorithm metadata (JSONB) |
| `UnresolvedTransaction` | `amount` | Numeric(12,2) | ❌ | Unmatched payment amount |
| `UnresolvedTransaction` | `description` | Text | ❌ | Transaction description |
| `UnresolvedTransaction` | `bank_date` | DateTime | ❌ | Original payment date |

### Relationships (Back-Populates Pattern per MEM005/MEM001)

```python
# BankTransaction side
matching_audits = relationship("TransactionMatchingAudit", back_populates="bank_transaction", lazy="selectin")

# TransactionMatchingAudit side  
bank_transaction = relationship("BankTransaction", back_populates="matching_audits")
invoice = relationship("Invoice")  # No back_populates - Invoice doesn't track matches
```

**Important:** `TransactionMatchingAudit.invoice` has NO `back_populates`. This means Invoice records don't track their matching audits directly.

## Critical Discovery: Supplier.INN Schema Issue

The Supplier model stores INN in a `requisites` Text field:

```python
class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    requisites = Column(Text, nullable=True)  # "ИНН: 7701234567, БИК: 044525225, р/с: ..."
```

**Impact on Matching:**
- Cannot query by INN directly: `WHERE suppliers.inn = ?` doesn't exist
- Must extract INN from text: `requisites LIKE '%ИНН:%'` pattern matching
- Risk: Multiple INN formats (ИНН, ИНН :, inn, etc.)

**Two Options:**

1. **Text Extraction (S04 scope):** Parse INN from `requisites` during matching
   - Pattern: `r"ИНН[:\s]*(\d{10}|\d{12})"` 
   - Fallback: Try multiple patterns if primary fails
   - Risk: False positives/negatives if format varies

2. **Schema Migration (deferred):** Add `Supplier.inn` column
   - Migration to extract and populate from existing `requisites`
   - Indexed for fast lookups
   - Better long-term but adds migration scope

**Recommendation:** Use text extraction in S04 to unblock matching. Schema migration can be added in a follow-up task or next milestone.

## Matching Algorithm Design

Based on `InvoiceVerifier` pattern (M003 S04), the matching service should:

### Input
- `bank_statement_id`: Integer (process all transactions from a statement)
- OR `bank_transaction_id`: Integer (process single transaction)

### Matching Strategy (Multi-Tier)

```
1. Exact INN + Amount Match → Direct match, confidence 1.00
2. INN Match + Amount ±5% → Partial match, confidence 0.85-0.99
3. No INN Match → Try supplier name from description (future: fuzzy match)
4. Multiple Candidates → Create UnresolvedTransaction for manual review
5. No Match → Create UnresolvedTransaction
```

### Amount Tolerance Calculation

```python
def amount_within_tolerance(bank_amount: Decimal, invoice_amount: Decimal, tolerance_pct: float = 5.0) -> bool:
    """Check if bank amount is within ±5% of invoice total."""
    if invoice_amount == 0:
        return False
    diff_pct = abs(bank_amount - invoice_amount) / invoice_amount * 100
    return diff_pct <= tolerance_pct
```

### Invoice Total Calculation

Since `Invoice` has no `total` column, must sum `InvoiceItem.total_price`:

```python
def get_invoice_total(db: Session, invoice_id: int) -> Decimal:
    """Calculate invoice total from line items."""
    result = db.query(func.sum(InvoiceItem.total_price)).filter(
        InvoiceItem.invoice_id == invoice_id
    ).first()
    return result[0] or Decimal('0.00')
```

### Date Proximity Check

```python
def payment_within_window(bank_date: datetime, invoice_created: datetime, max_days: int = 90) -> bool:
    """Check if payment is within reasonable window after invoice."""
    if bank_date < invoice_created:
        return False  # Payment before invoice doesn't make sense
    delta = bank_date - invoice_created
    return delta.days <= max_days
```

## Service Structure (Following InvoiceVerifier Pattern)

```python
class PaymentMatcher:
    """
    Payment auto-matching service linking BankTransactions to Invoices.
    
    Matches payments using:
    1. Supplier.INN (extracted from requisites text field)
    2. Amount ±5% tolerance
    3. Date proximity (payment within 90 days of invoice)
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def match_bank_statement(self, bank_statement_id: int) -> MatchResult:
        """Match all transactions from a bank statement."""
        
    def match_single_transaction(self, bank_transaction_id: int) -> MatchResult:
        """Match a single bank transaction."""
        
    def _extract_supplier_inn(self, supplier: Supplier) -> Optional[str]:
        """Extract INN from Supplier.requisites text field."""
        
    def _find_matching_invoices(self, bank_txn: BankTransaction) -> List[InvoiceCandidate]:
        """Find invoices matching INN + amount + date criteria."""
        
    def _create_payment_record(self, bank_txn: BankTransaction, invoice: Invoice, confidence: float):
        """Create Payment and TransactionMatchingAudit records."""
        
    def _create_unresolved_transaction(self, bank_txn: BankTransaction, reason: str):
        """Create UnresolvedTransaction for unmatched payments."""
```

## Invoice Status Update Flow

When a payment is matched to an invoice:

```
Invoice.status: "Сверен" → "Оплачен"
Payment.bank_transaction_id: <BankTransaction reference>
Payment.payment_date: <BankTransaction.transaction_date>
Payment.amount: <BankTransaction.amount>
TransactionMatchingAudit: Created with confidence_score
```

**Partial Payment Handling (future scope):**
- Current scope: Single payment = single invoice match
- Future: Multiple partial payments accumulate to invoice total
- For S04: Match first payment, mark as "Оплачен" (assume full payment)

## Unresolved Transaction Creation

When matching fails, create `UnresolvedTransaction`:

```python
unresolved = UnresolvedTransaction(
    amount=bank_txn.amount,
    description=bank_txn.description,
    bank_date=bank_txn.transaction_date,
    status="Не распределено"  # Default status
)
```

**Reasons for unresolved:**
- Supplier not found (INN not in database)
- No invoices for supplier
- Amount outside tolerance (±5%)
- Payment date outside window (> 90 days)
- Multiple candidates (ambiguous)

## Database Queries

### Query 1: Find Supplier by INN (with text extraction)

```python
# First: Extract INNs from all suppliers with requisites
suppliers = db.query(Supplier).filter(Supplier.requisites.isnot(None)).all()
supplier_by_inn = {}
for s in suppliers:
    inn = self._extract_supplier_inn(s)
    if inn:
        supplier_by_inn[inn] = s
```

### Query 2: Find Invoices by Supplier (via PurchaseOrder)

```python
invoices = (
    db.query(Invoice)
    .join(PurchaseOrder, Invoice.purchase_order_id == PurchaseOrder.id)
    .filter(PurchaseOrder.supplier_id == supplier_id)
    .filter(Invoice.status.in_(["Сверен", "Ожидает оплаты"]))  # Only payable invoices
    .all()
)
```

### Query 3: Get Invoice Total

```python
from sqlalchemy import func

total = (
    db.query(func.sum(InvoiceItem.total_price))
    .filter(InvoiceItem.invoice_id == invoice_id)
    .scalar() or Decimal('0.00')
)
```

## Constraints and Edge Cases

### Edge Case 1: BankTransaction with NULL supplier_inn
- **Action:** Skip matching, create UnresolvedTransaction
- **Reason:** No primary key for matching

### Edge Case 2: Supplier without requisites
- **Action:** Skip this supplier, check other candidates
- **Reason:** Cannot extract INN

### Edge Case 3: Multiple invoices with same supplier and amount
- **Action:** Create UnresolvedTransaction for manual review
- **Reason:** Ambiguous match, auto-matching risky

### Edge Case 4: Payment amount > invoice total (shouldn't happen)
- **Action:** Create UnresolvedTransaction
- **Reason:** Possible data error, needs human review

### Edge Case 5: Payment date before invoice created
- **Action:** Skip this invoice
- **Reason:** Temporal inconsistency

## Files to Create/Modify

### New Files
1. `backend/services/payment_matcher.py` - Main matching service
2. `backend/services/supplier_inn_extractor.py` - INN extraction utility
3. `backend/tasks.py` - Add `match_bank_transactions` Celery task
4. `backend/tests/test_payment_matcher.py` - Unit tests for matcher
5. `backend/tests/test_supplier_inn_extractor.py` - INN extraction tests
6. `backend/tests/fixtures/` - Add matching test fixtures

### Modified Files
1. `backend/models.py` - No schema changes (requisites field stays as-is)
2. `backend/celery_app.py` - No changes (use existing queues)
3. `backend/tasks.py` - Add `match_bank_transactions` task

## Dependencies

### Existing (Already Installed)
- `sqlalchemy` - ORM queries
- `decimal` - Precise amount calculations
- `pytest` - Testing framework

### New Dependencies
- None required (all functionality uses standard library + existing stack)

## Testing Strategy

### Unit Tests
1. **INN Extraction:** Test various requisites formats
   - `ИНН: 7701234567, БИК: 044525225`
   - `ИНН 7701234567`
   - `inn:7701234567`
   - Mixed formats, missing INN

2. **Amount Tolerance:** Test ±5% calculations
   - Exact match
   - Within tolerance (4.9%)
   - Outside tolerance (5.1%)
   - Zero invoice amount edge case

3. **Date Proximity:** Test 90-day window
   - Within window
   - Outside window
   - Payment before invoice

4. **Matching Logic:** Full flow tests
   - Single exact match
   - Multiple candidates → unresolved
   - No supplier → unresolved
   - Amount mismatch → unresolved

### Integration Tests
1. End-to-end: BankStatement → BankTransaction → Payment
2. UnresolvedTransaction creation verification
3. Invoice.status update verification
4. TransactionMatchingAudit record verification

### Test Fixtures Needed
```
backend/tests/fixtures/
├── matching_scenario_simple.txt       # One supplier, one invoice, exact match
├── matching_scenario_tolerance.txt    # Amount within ±5%
├── matching_scenario_ambiguous.txt    # Multiple candidates
├── matching_scenario_unknown.txt     # Supplier INN not in DB
└── supplier_requisites_variants.txt   # Various INN formats
```

## Implementation Order

1. **T01: INN Extractor** (Independent, low risk)
   - Create `supplier_inn_extractor.py`
   - Parse requisites text, extract INN
   - Handle multiple formats, edge cases

2. **T02: Payment Matcher Core** (Depends on T01)
   - Create `payment_matcher.py`
   - Implement multi-tier matching logic
   - Amount tolerance, date proximity checks

3. **T03: Payment & UnresolvedTransaction Creation** (Depends on T02)
   - Create Payment records on match
   - Create UnresolvedTransaction on no match
   - Update Invoice.status

4. **T04: Celery Task Integration** (Depends on T03)
   - Add `match_bank_transactions` task to `tasks.py`
   - Follow existing pattern from `parse_bank_statement`
   - Call from `parse_bank_statement` after persistence

5. **T05: Unit + Integration Tests** (Depends on T01-T04)
   - Test INN extraction variants
   - Test matching logic scenarios
   - End-to-end integration test

## Verification Strategy

### Manual Testing
```bash
# 1. Create test data: Supplier with INN in requisites, Invoice, BankTransaction
# 2. Run matcher: python -m backend.tasks match_bank_transactions <bank_statement_id>
# 3. Verify:
#    - Payment record created with correct invoice_id
#    - Invoice.status = "Оплачен"
#    - TransactionMatchingAudit created with confidence_score
#    - UnresolvedTransaction created for unmatched payments
```

### Automated Testing
```bash
pytest backend/tests/test_payment_matcher.py -v
pytest backend/tests/test_supplier_inn_extractor.py -v
pytest backend/tests/test_matching_integration.py -v
```

## Risks and Unknowns

### Risk 1: INN Extraction Reliability
- **Issue:** `requisites` field format varies across suppliers
- **Impact:** False negatives (valid supplier not matched)
- **Mitigation:** Test with multiple real-world requisites formats, add fallback patterns

### Risk 2: Amount Ambiguity
- **Issue:** Bank statement amount may include fees/commisions
- **Impact:** Amount mismatch even for correct invoice
- **Mitigation:** Tolerance (±5%) handles minor variations

### Risk 3: Multiple Invoices Same Supplier/Amount
- **Issue:** Two invoices from same supplier with identical totals
- **Impact:** UnresolvedTransaction created (manual review needed)
- **Mitigation:** This is expected behavior - human decision required

### Risk 4: Partial Payments
- **Issue:** S04 assumes full payment per transaction
- **Impact:** Partial payments may not match correctly
- **Mitigation:** Deferred to future scope (partial payment handling)

## Sources

- M004-CONTEXT.md: Milestone requirements and acceptance criteria
- M004-ROADMAP.md: Slice dependencies and integration points
- backend/models.py: BankTransaction, Invoice, Supplier, TransactionMatchingAudit, UnresolvedTransaction schemas
- backend/services/invoice_verifier.py: Pattern for matching service design
- backend/services/bank_statement_parser.py: Understanding BankTransaction field population
- backend/tests/test_bank_statement_integration.py: Test patterns for integration testing
- backend/supplier_resolver.py: Pattern for Supplier lookup logic
- backend/celery_app.py: Existing task routing and queue configuration

## Don't Hand-Roll (Use Existing Patterns)

1. **Matching Service Pattern:** Follow `InvoiceVerifier` class structure
   - `__init__(db: Session)` constructor
   - Main verification method returning result object
   - Private helper methods for each matching step
   - Logger statements for each stage

2. **Celery Task Pattern:** Follow `parse_bank_statement` task structure
   - `@app.task(name='tasks.match_bank_transactions', bind=True)` decorator
   - `max_retries=2` with exponential backoff
   - `try/except RateLimitError` handling
   - Return dict with status, counts, IDs

3. **Test Pattern:** Follow `test_bank_statement_integration.py` structure
   - `call_*_task_helper()` to bypass Celery wrapper
   - Fixtures for test data
   - ORM queries for verification
   - Decimal precision checks

4. **Schema Pattern:** Follow existing Pydantic v2 pattern
   - `model_config = ConfigDict(from_attributes=True)`
   - Use `BaseSchema` parent class
   - JSONB-compatible types for matching_context

## Follow-ups (Future Scope)

1. **Supplier.inn Column Migration:** Add dedicated INN column to Supplier table
   - Migration extracts INN from requisites
   - Index for fast lookups
   - Makes matching more reliable

2. **Partial Payment Support:** Allow multiple payments per invoice
   - Track cumulative paid amount
   - Update Invoice.status only when fully paid

3. **Supplier Name Fuzzy Matching:** Match by name when INN missing
   - Use RapidFuzz (already in project from invoice_verifier)
   - Handle name variations

4. **Learning from Manual Corrections:** Record UnresolvedTransaction resolutions
   - Use resolved matches to improve auto-matching
   - Build confidence from historical data

## Summary for Planner

**Files and Purpose:**
- `backend/services/supplier_inn_extractor.py` - Extract INN from Supplier.requisites text
- `backend/services/payment_matcher.py` - Main matching service (INN + amount ±5% + date)
- `backend/tasks.py` - Add `match_bank_transactions` Celery task
- `backend/tests/test_payment_matcher.py` - Unit tests for matching logic
- `backend/tests/test_supplier_inn_extractor.py` - INN extraction tests
- `backend/tests/test_matching_integration.py` - End-to-end integration tests

**Natural Seams:**
1. INN extractor (independent, pure function)
2. Payment matcher core (depends on INN extractor)
3. Payment/UnresolvedTransaction creation (depends on matcher)
4. Celery task wrapper (depends on all above)
5. Tests (verify each seam independently)

**First Proof:** T01 INN Extractor - validates core assumption that requisites can be parsed reliably.

**Verification Commands:**
```bash
pytest backend/tests/test_supplier_inn_extractor.py -v
pytest backend/tests/test_payment_matcher.py -v
pytest backend/tests/test_matching_integration.py -v
```
