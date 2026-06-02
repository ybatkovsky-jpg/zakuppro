---
estimated_steps: 20
estimated_files: 5
skills_used: []
---

# T01: Create analytics router with dashboard metrics endpoint

## Why
Dashboard analytics endpoints provide frontend with key financial metrics (paid/unpaid invoice counts, total amounts, pending invoices) for project management visibility.

## Do
1. Create `backend/routers/analytics.py` with:
   - GET /api/analytics/dashboard - returns paid_invoices_count, unpaid_invoices_count, total_paid_amount, total_unpaid_amount, pending_invoices_count (status='Сверен'), optional period_start/period_end filters
   - Use SQLAlchemy func.count(), func.sum() for aggregations on Payment and Invoice tables
   - Default to last 30 days if no date range specified
   - Validate date range max 1 year
   - Add structured logging for filter parameters and result counts
2. Create Pydantic response schemas in `backend/schemas.py`:
   - DashboardMetricsResponse(BaseSchema) with all metric fields
   - PaymentDynamicsResponse for time-series data
3. Add schemas to `backend/schemas/__init__.py` re-export using importlib pattern
4. Register router in `backend/main.py`
5. Create unit tests in `backend/tests/test_api/test_analytics.py`

## Done when
- /api/analytics/dashboard returns 200 with correct metric counts
- Tests pass with empty DB, single record, multiple records
- Date range filtering and validation work correctly
- Router is registered and accessible via TestClient

## Inputs

- `backend/routers/unresolved_transactions.py`
- `backend/schemas.py`
- `backend/schemas/__init__.py`
- `backend/main.py`
- `backend/models.py`
- `backend/tests/test_api/test_unresolved_transactions.py`

## Expected Output

- `backend/routers/analytics.py`
- `backend/tests/test_api/test_analytics.py`

## Verification

pytest backend/tests/test_api/test_analytics.py -v -k dashboard

## Observability Impact

Structured logging at dashboard endpoint with filter parameters (date range) and result counts (paid/unpaid/pending invoices, total amounts)
