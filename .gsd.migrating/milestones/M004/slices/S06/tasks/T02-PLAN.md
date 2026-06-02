---
estimated_steps: 22
estimated_files: 4
skills_used: []
---

# T02: Add payment dynamics time-series endpoint and Excel export for transactions

## Why
Payment dynamics endpoint provides time-series data for frontend charts (payments over time grouped by day/week/month). Excel export allows accountants to download transaction data for offline analysis.

## Do
1. Extend `backend/routers/analytics.py` with:
   - GET /api/analytics/payment-dynamics - query params: period_start, period_end, group_by (day/week/month, default 'day')
   - Use SQLAlchemy func.date() or date_trunc() for grouping
   - Return [{date, paid_amount, unpaid_amount}, ...]
   - Add PaymentDynamicsResponse schema
2. Add GET /api/analytics/export/transactions:
   - Query parameters: date_from, date_to (same filters as unresolved-transactions list)
   - Query using joinedload for nested Invoice/Supplier data
   - Convert to pandas DataFrame with columns: date, amount, invoice_id, supplier, project, description
   - Use io.BytesIO() + df.to_excel(engine='openpyxl', index=False)
   - Return Response with media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Content-Disposition='attachment; filename=transactions.xlsx'
   - Limit to 1000 rows max
   - Log export date range and row count
3. Create unit tests for both endpoints in `backend/tests/test_api/test_analytics.py`

## Done when
- /api/analytics/payment-dynamics returns grouped time-series data
- /api/analytics/export/transactions returns downloadable .xlsx file
- Content-Type and Content-Disposition headers are correct
- Tests verify pandas can parse the exported Excel

## Inputs

- `backend/routers/analytics.py`
- `backend/schemas.py`
- `backend/routers/unresolved_transactions.py`
- `backend/models.py`
- `backend/tests/test_api/test_analytics.py`

## Expected Output

- `backend/routers/analytics.py`
- `backend/tests/test_api/test_analytics.py`

## Verification

pytest backend/tests/test_api/test_analytics.py -v -k dynamics or export

## Observability Impact

Payment dynamics endpoint logs grouping period and date range. Export endpoint logs date range and exported row count.
