# S06 Research: Analytics + Export + Manual Upload

## Research Depth
**Targeted Research** - Known technology patterns (FastAPI routers, SQLAlchemy queries, pandas Excel operations) applied to new domain (financial analytics, file upload handling).

## Summary

Slice S06 delivers three independent features for financial visibility:
1. **Analytics endpoints** - Dashboard data (paid/unpaid invoice counts, payment dynamics by time period)
2. **Excel export** - Download transaction data as .xlsx file
3. **Manual bank statement upload** - Fallback endpoint to upload .txt files outside email flow

All three features use established patterns from the codebase:
- Router pattern from `unresolved_transactions.py` (filters, pagination, query building)
- Excel handling from `excel_parser.py` (pandas for data manipulation)
- File upload pattern from `handlers/documents.py` (validation, error handling)

Risk is **low** - no new libraries required, clear precedents exist.

## Files and Purpose

### Existing Files to Reference
| File | Purpose for S06 |
|------|-----------------|
| `backend/routers/unresolved_transactions.py` | Query patterns for filtering, pagination, joinedload for nested data |
| `backend/excel_parser.py` | pandas DataFrame patterns for Excel operations |
| `backend/handlers/documents.py` | File validation patterns (extension, size limits) |
| `backend/services/bank_statement_parser.py` | Parser service for uploaded 1C ClientBank files |
| `backend/models.py` | Invoice, Payment, UnresolvedTransaction models for analytics queries |
| `backend/schemas.py` | Pydantic schema patterns (extend with analytics response schemas) |
| `backend/main.py` | Router registration (add new analytics/export router) |

### Files to Create
| File | Purpose |
|------|---------|
| `backend/routers/analytics.py` | New router for analytics + export + upload endpoints |
| `backend/tests/test_api/test_analytics.py` | API unit tests for analytics endpoints |
| `backend/tests/test_analytics_integration.py` | Integration tests for full analytics/export flow |

## Implementation Landscape

### Feature 1: Analytics Endpoints

**Purpose**: Provide dashboard data for frontend - counts and aggregated financial metrics.

**Endpoints to implement**:
```
GET /api/analytics/dashboard
  Returns: {
    paid_invoices_count: int,
    unpaid_invoices_count: int,
    total_paid_amount: Decimal,
    total_unpaid_amount: Decimal,
    pending_invoices_count: int,  # status='Сверен'
    period_start: date,  // optional filter
    period_end: date     // optional filter
  }

GET /api/analytics/payment-dynamics
  Query params: period_start, period_end, group_by (day/week/month)
  Returns: [
    { date: "2026-01-01", paid_amount: 15000.00, unpaid_amount: 5000.00 },
    ...
  ]
```

**Query patterns** (from `unresolved_transactions.py`):
- SQLAlchemy `func.count()`, `func.sum()` for aggregations
- `filter()` for date ranges
- `group_by()` for time-series data

**Schema pattern** (extend `schemas.py`):
```python
class DashboardMetricsResponse(BaseSchema):
    paid_invoices_count: int
    unpaid_invoices_count: int
    total_paid_amount: Optional[float]
    total_unpaid_amount: Optional[float]
    pending_invoices_count: int
    period_start: Optional[datetime]
    period_end: Optional[datetime]
```

### Feature 2: Excel Export

**Purpose**: Download filtered transaction data as .xlsx file.

**Implementation approach** (FastAPI + pandas):
```python
from fastapi import Response
import pandas as pd

@router.get("/export/transactions")
def export_transactions(
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    db: Session = Depends(get_db)
):
    # Query transactions (same filters as list endpoint)
    # Convert to pandas DataFrame
    # Use df.to_excel() with BytesIO
    # return Response(content=bytes, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
```

**Library choice**: `openpyxl` (already in requirements.txt)
- pandas `to_excel()` uses openpyxl engine by default
- Sufficient for tabular exports
- No additional dependencies

**Response pattern** (from web search):
- Use `Response()` with `.xlsx` media type
- Add `Content-Disposition: attachment; filename="transactions.xlsx"`
- Stream via `io.BytesIO()`

### Feature 3: Manual Upload

**Purpose**: Fallback for uploading bank statements outside email flow.

**Implementation approach**:
```python
from fastapi import UploadFile

@router.post("/upload-bank-statement")
async def upload_bank_statement(
    file: UploadFile,
    db: Session = Depends(get_db)
):
    # Validate file extension (.txt)
    # Validate file size (limit ~5MB)
    # Read file content
    # Call BankStatementParser.parse()
    # Persist BankStatement + BankTransaction records
    # Return parsed transaction count
```

**Validation patterns** (from `handlers/documents.py`):
- Extension check: `file.filename.lower().endswith('.txt')`
- Size limit: `await file.read()` then check length
- Error response: `400 Bad Request` with detail message

**Parser integration** (from `services/bank_statement_parser.py`):
- `BankStatementParser.parse(bytes)` returns structured data
- Create `BankStatement` and `BankTransaction` records
- Match via `PaymentMatcher` or create `UnresolvedTransaction`

## Natural Seams

The three features are **independent** and can be developed in parallel:

1. **Analytics** (T01): Self-contained queries, no external deps
2. **Export** (T02): Depends on analytics query results, adds pandas Excel output
3. **Upload** (T03): Self-contained file handling + parser integration

**Recommended order**: Analytics → Export → Upload
- Analytics provides query foundation for export
- Upload is standalone, can be done anytime

## First Proof

**Highest risk**: Excel export file handling (new to this codebase).

**Verification spike**:
1. Create minimal export endpoint that returns hardcoded DataFrame as .xlsx
2. Test file downloads correctly in browser/TestClient
3. Verify `.xlsx` can be opened in Excel/LibreOffice

**Success criteria**:
- HTTP 200 response
- Content-Type header matches Excel MIME type
- File opens without corruption

## Don't Hand-Roll

### Use Existing Patterns
- **SQLAlchemy aggregations**: Use `func.count()`, `func.sum()`, `group_by()` - don't aggregate in Python
- **Date filtering**: Use SQLAlchemy `filter(column >= date_from, column <= date_to)` - don't filter iteratively
- **Excel formatting**: Use pandas `to_excel()` with header/index parameters - don't write raw XML
- **File validation**: Reuse extension/size checks from `handlers/documents.py` - don't reimplement

### Avoid Reinventing
- **Excel MIME type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (standard, don't guess)
- **BytesIO streaming**: Use `io.BytesIO()` for in-memory file (FastAPI pattern, don't write temp files)
- **UploadFile async**: Use `await file.read()` for FastAPI upload (sync read will block)

## Constraints

### Database
- Queries must use existing models: Invoice, Payment, UnresolvedTransaction
- No new tables required for analytics
- Use SQLAlchemy 2.0 syntax (already in codebase)

### File Sizes
- Bank statement .txt: Typically <1MB, set max 5MB for upload
- Excel export: Limit to 1000 rows (reuse pagination limit from list endpoints)

### Date Ranges
- Default to last 30 days if not specified
- Maximum range: 1 year to prevent long-running queries

### Encoding
- Bank statements are CP1251 (handled by parser)
- Excel export: UTF-8 (pandas default)

## Observability Surfaces

- **Structured logging** at each analytics query (filters applied, result counts)
- **Export**: Log export date range and row count
- **Upload**: Log file name, size, parse result
- **Error responses**: Include detail field for debugging

## Sources

### Web Search Results
- [FastAPI Excel Export Guide](https://blog.csdn.net/gitblog_00084/article/details/142021823) - pandas + XlsxWriter implementation
- [FastAPI FileResponse Example](https://stackoverflow.com/questions/72052908/how-to-return-and-download-excel-file-using-fastapi) - Download link in Swagger UI
- [FastAPI Sending Excel](https://medium.com/@balajichandrasekar17/fast-api-sending-excel-in-api-respone-1c291b392604) - FileResponse usage
- [Financial Analytics with Pandas](https://medium.com/@kyle-t-jones/integrating-excel-and-python-for-business-analytics-53281e2985e2) - Data aggregation patterns
- [Python Financial Data Analysis](https://python.plainenglish.io/how-to-extract-financial-data-with-python-and-excel-a-practical-step-by-step-guide-7a3530084245) - Practical financial data workflows

### Codebase References
- `backend/routers/unresolved_transactions.py` - Filter/query patterns
- `backend/excel_parser.py` - pandas DataFrame operations
- `backend/handlers/documents.py` - File validation
- `backend/services/bank_statement_parser.py` - Parser integration
- `backend/tests/test_api/test_unresolved_transactions.py` - API test patterns

## Implementation Notes

### Analytics Query Examples

```python
from sqlalchemy import func

# Dashboard metrics
paid_count = db.query(func.count(Payment.id)).filter(
    Payment.payment_date >= date_from
).scalar()

unpaid_count = db.query(Invoice).filter(
    Invoice.status == 'Сверен',
    Invoice.created_at >= date_from
).count()

# Payment dynamics
results = db.query(
    func.date(Payment.payment_date).label('date'),
    func.sum(Payment.amount).label('total_paid')
).filter(
    Payment.payment_date >= date_from,
    Payment.payment_date <= date_to
).group_by(func.date(Payment.payment_date)).all()
```

### Excel Export Example

```python
import io
import pandas as pd
from fastapi import Response

@router.get("/export/transactions")
def export_transactions(db: Session = Depends(get_db)):
    # Query data
    transactions = db.query(Payment, Invoice).join(...).all()
    
    # Convert to DataFrame
    df = pd.DataFrame([
        {
            "date": t.payment_date,
            "amount": float(t.amount),
            "invoice_id": t.invoice_id,
            "supplier": "..."  # nested data
        }
        for t in transactions
    ])
    
    # Write to Excel
    output = io.BytesIO()
    df.to_excel(output, index=False, engine='openpyxl')
    output.seek(0)
    
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=transactions.xlsx"}
    )
```

### Manual Upload Example

```python
from fastapi import UploadFile

@router.post("/upload-bank-statement")
async def upload_bank_statement(
    file: UploadFile,
    db: Session = Depends(get_db)
):
    # Validate extension
    if not file.filename.lower().endswith('.txt'):
        raise HTTPException(400, "Only .txt files supported")
    
    # Read content
    content = await file.read()
    
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(400, "File too large (max 5MB)")
    
    # Parse
    parser = BankStatementParser()
    parsed = parser.parse(content)
    
    # Persist
    # ... (BankStatement + BankTransaction records)
    
    return {"parsed_transactions": len(parsed['transactions'])}
```

## Verification Strategy

### Unit Tests (per endpoint)
- Analytics: Test with empty DB, single record, multiple records
- Export: Verify Content-Type, filename, can be parsed by pandas
- Upload: Test valid/invalid extension, size limits, parser error handling

### Integration Tests
- End-to-end: Create data → call analytics → verify counts match
- Export: Query filtered data → export → import in pandas → verify row count
- Upload: Upload test .txt → verify BankStatement created → verify transactions

### API Contract Tests
- Verify response schemas match Pydantic models
- Test error responses (400, 404, 500)
- Verify pagination/limit enforcement

## Open Questions

None - all patterns and libraries are established in the codebase.