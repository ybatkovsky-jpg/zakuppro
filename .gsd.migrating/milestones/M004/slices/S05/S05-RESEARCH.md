# S05: Transaction Matching API - Research

## Research Depth: Targeted

This slice builds upon existing CRUD patterns in the codebase. The router and basic schemas already exist; this slice adds filter/search capabilities, bulk manual matching, and audit history endpoints. No new technologies or unfamiliar patterns are introduced.

## Existing Infrastructure

### Files Already Present

| File | Purpose | Status |
|------|---------|--------|
| `backend/routers/unresolved_transactions.py` | Basic CRUD endpoints (GET, POST, PUT, DELETE) | Complete, needs extensions |
| `backend/models.py` | UnresolvedTransaction ORM model (lines 143-153) | Complete |
| `backend/schemas.py` | UnresolvedTransactionCreate, Update, Response schemas (lines 278-302) | Complete, needs extensions |
| `backend/services/payment_matcher.py` | PaymentMatcher service with matching logic | Complete, reusable for manual matching |

### UnresolvedTransaction Model

```python
class UnresolvedTransaction(Base):
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=True)  # Transaction description from bank
    bank_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), nullable=False, default="Не распределено")  # Не распределено, Привязано вручную
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

**Key observations:**
- No foreign key to BankTransaction (intentional - UnresolvedTransaction is a standalone record for manual reconciliation)
- Status field supports workflow transitions ("Не распределено" → "Привязано вручную")
- Missing: `supplier_inn` field for filtering by supplier ( BankTransaction has this, but UnresolvedTransaction doesn't preserve it)

### TransactionMatchingAudit Model

```python
class TransactionMatchingAudit(Base):
    id = Column(Integer, primary_key=True, index=True)
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    matched_at = Column(DateTime(timezone=True), nullable=False)
    matched_by = Column(String(50), nullable=False)  # 'auto', 'manual', or user_id
    confidence_score = Column(Numeric(3, 2), nullable=True)  # 0.00-1.00
    matching_context = Column(JSON, nullable=True)  # Algorithm details
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

**Note:** This model tracks auto-matched transactions (BankTransaction → Invoice). For manual matching (UnresolvedTransaction → Invoice), we'll reuse this pattern or create a new audit entry.

## What Needs to Be Built

### 1. Filter and Search Endpoints

**Current list endpoint:**
```python
@router.get("/", response_model=List[UnresolvedTransactionResponse])
def list_unresolved_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = db.query(UnresolvedTransaction).offset(skip).limit(limit).all()
    return transactions
```

**Required additions:**
- `status` filter (exact match: "Не распределено", "Привязано вручную")
- `amount_min`, `amount_max` range filters
- `date_from`, `date_to` date range filters
- `description` search (case-insensitive substring match)
- Ordering options (by date, amount, status)

**Pattern to follow:** Existing pagination pattern in `backend/routers/projects.py` (lines 123-148) uses `skip` and `limit` query parameters.

### 2. Bulk Manual Matching Endpoint

**Purpose:** Allow accountants to select multiple unresolved transactions and match them to specific invoices in one operation.

**Proposed endpoint:**
```
POST /api/unresolved-transactions/bulk-match
```

**Request body:**
```python
class BulkMatchRequest(BaseModel):
    matches: List[BulkMatchItem]

class BulkMatchItem(BaseModel):
    unresolved_transaction_id: int
    invoice_id: int
    amount: Optional[float] = None  # Override transaction amount
```

**Response:**
```python
class BulkMatchResponse(BaseModel):
    matched_count: int
    failed_count: int
    payment_ids: List[int]
    errors: List[str]
```

**Implementation approach:**
1. Validate unresolved transaction exists and has status "Не распределено"
2. Validate invoice exists
3. For each match: create Payment record, create TransactionMatchingAudit with `matched_by="manual"`, update UnresolvedTransaction.status to "Привязано вручную"
4. Return summary with counts and any errors

### 3. Manual Match Single Transaction Endpoint

**Purpose:** Quick single-match action from UI.

**Proposed endpoint:**
```
POST /api/unresolved-transactions/{transaction_id}/match
```

**Request body:**
```python
class ManualMatchRequest(BaseModel):
    invoice_id: int
    amount: Optional[float] = None
```

**Response:** PaymentResponse

### 4. Invoice Candidate Suggestions

**Purpose:** Help accountants find matching invoices by suggesting candidates based on amount tolerance and date proximity.

**Proposed endpoint:**
```
GET /api/unresolved-transactions/{transaction_id}/candidates
```

**Query parameters:**
- `amount_tolerance_percent` (default: 10.0 - wider than auto-match for manual review)
- `date_window_days` (default: 90)

**Response:**
```python
class InvoiceCandidate(BaseModel):
    invoice_id: int
    purchase_order_id: int
    supplier_name: str
    invoice_total: float
    amount_difference: float
    confidence_score: float
```

**Implementation:** Reuse `PaymentMatcher._find_invoice_candidates()` logic with relaxed tolerances.

### 5. Audit History Endpoints

**Purpose:** Show history of manual matching actions for transparency and troubleshooting.

**Proposed endpoint:**
```
GET /api/unresolved-transactions/audit-history
```

**Query parameters:**
- `transaction_id` (filter by unresolved transaction ID - requires adding `unresolved_transaction_id` FK or tracking via matching_context)
- `invoice_id` (filter by matched invoice)
- `date_from`, `date_to`
- `matched_by` (filter by "auto" or "manual")

**Response:** List of TransactionMatchingAudit records with nested Invoice/BankTransaction details.

**Note:** TransactionMatchingAudit currently tracks BankTransaction, not UnresolvedTransaction. Two options:
1. Add `unresolved_transaction_id` column to TransactionMatchingAudit (simpler, extends existing pattern)
2. Create new UnresolvedTransactionAudit model (cleaner separation)

**Recommendation:** Add `unresolved_transaction_id` nullable FK to TransactionMatchingAudit for unified audit trail.

## Implementation Landscape

### Files to Modify

| File | Changes |
|------|---------|
| `backend/routers/unresolved_transactions.py` | Add filter/search, bulk-match, single-match, candidates endpoints |
| `backend/schemas.py` | Add BulkMatchRequest, BulkMatchResponse, ManualMatchRequest, InvoiceCandidate, filter schemas |
| `backend/models.py` | Optionally add `unresolved_transaction_id` to TransactionMatchingAudit |
| `backend/main.py` | No changes needed (router already included) |

### Files to Create

| File | Purpose |
|------|---------|
| `backend/tests/test_api/test_unresolved_transactions.py` | API endpoint tests (filters, bulk match, candidates) |
| `backend/tests/test_unresolved_matching_integration.py` | Integration test: unresolved → matched workflow |

### New Service (Optional)

Consider creating `backend/services/manual_matcher.py` to encapsulate:
- Candidate suggestion logic
- Manual matching validation
- Audit trail creation

However, most logic can reuse `PaymentMatcher` with `matched_by="manual"` parameter.

## Architectural Decisions

### 1. Filter Implementation

**Decision:** Use SQLAlchemy query building with optional filter parameters.

**Rationale:** Standard pattern for REST APIs. Keep query construction in router layer (no separate repository layer needed for this complexity).

### 2. Bulk Match Transaction Safety

**Decision:** Use database transaction with rollback on any failure.

**Rationale:** Partial success in bulk operations creates inconsistent state. Either all matches succeed or none do.

**Implementation:** Wrap bulk match in `db.begin_nested()` context, rollback on exception.

### 3. Audit Trail Approach

**Decision:** Extend TransactionMatchingAudit with `unresolved_transaction_id` nullable FK.

**Rationale:** 
- Unified audit trail for auto and manual matches
- Single query for all matching history
- Backward compatible (NULL for existing auto-match records)

**Alternative considered:** Separate UnresolvedTransactionAudit table. Rejected because it splits audit history across two tables.

### 4. Candidate Suggestion Tolerances

**Decision:** Wider tolerances for manual matching (10% amount, 90 days) vs auto-match (5%, 30 days).

**Rationale:** Manual review allows human judgment; we want to show more candidates even if confidence is lower.

## Integration Points

### Consumes

- **UnresolvedTransaction model** (M004 S01) - Source records for manual reconciliation
- **Invoice model** (M003) - Target for manual matching
- **Payment model** (M004 S04) - Created on successful manual match
- **TransactionMatchingAudit model** (M004 S04) - Extended for manual match audit

### Produces

- **Payment records** - Created when UnresolvedTransaction is manually matched
- **Invoice.status updates** - May trigger "Оплачен" status update
- **TransactionMatchingAudit records** - Audit trail for manual matches

## Testing Requirements

### Unit Tests

1. **Filter tests:** Verify each filter parameter (status, amount range, date range, description search)
2. **Candidate suggestion tests:** Verify invoice candidates returned with correct confidence scores
3. **Bulk match tests:** Verify transaction wrapping, partial rollback on error
4. **Single match tests:** Verify Payment and Audit creation, status update

### Integration Tests

1. **End-to-end workflow:** UnresolvedTransaction creation → candidate suggestion → manual match → Payment creation → status update
2. **Bulk match workflow:** Multiple unresolved → bulk match → multiple Payments created
3. **Audit history retrieval:** Verify manual matches appear in audit trail

### Test Pattern

Follow `backend/tests/test_api/test_projects.py` pattern:
- Use `test_client` fixture from conftest
- Test classes grouped by endpoint
- Arrange-Act-Assert structure
- Verify 201/404/422 status codes

## Constraints and Considerations

1. **No authentication in current scope:** API endpoints have no auth middleware (this is pre-M005 UI work)
2. **Decimal precision:** Payment amounts use Numeric(12, 2) - handle Decimal conversion in Pydantic schemas
3. **Russian language:** Status values use Russian labels ("Не распределено", "Привязано вручную")
4. **Cascade behavior:** Deleting Invoice cascades to Payments; deleting UnresolvedTransaction should be prevented after manual match (soft-delete via status instead)

## Verification Commands

```bash
# Unit tests
pytest backend/tests/test_api/test_unresolved_transactions.py -v

# Integration tests
pytest backend/tests/test_unresolved_matching_integration.py -v

# Full test suite
pytest backend/tests/ -k "unresolved" -v
```

## Recommendations

1. **Start with filters** - Lowest risk, immediate value for accountants
2. **Add candidate suggestions** - Enables efficient manual matching
3. **Implement single match** - Core workflow validation
4. **Add bulk match** - Optimization for batch processing
5. **Extend audit trail** - Transparency and debugging support

## Open Questions

None - all technical decisions are clear from existing patterns.
