---
estimated_steps: 25
estimated_files: 4
skills_used: []
---

# T06: Replace Analytics API Routes with FastAPI Proxy

## Why
Analytics dashboard needs real metrics from FastAPI for financial visibility.

## Do
1. Replace `src/app/api/analytics/pipeline/route.ts`:
   - Current: Aggregates ProjectItem status counts from Prisma
   - New: Check if FastAPI has equivalent endpoint
   - If yes: Proxy to it
   - If no: Keep aggregation but fetch items via FastAPI (temporary)

2. Replace `src/app/api/analytics/suppliers/route.ts`:
   - Check FastAPI endpoint availability
   - Proxy or implement based on backend

3. Create `src/app/api/analytics/dashboard/route.ts` (new if needed):
   - Proxy to `/api/analytics/dashboard`
   - Transform response: camelCase fields
   - Metrics: paid_invoices_count, unpaid_invoices_count, total_paid_amount, total_unpaid_amount

4. Create `src/app/api/analytics/payment-dynamics/route.ts` (new if needed):
   - Proxy to `/api/analytics/payment-dynamics`
   - Transform time series data

## Constraints
- Date format handling (Python datetime vs JS Date)
- Decimal precision for currency amounts

## Done when
- Analytics routes proxy to FastAPI
- Dashboard metrics load correctly
- Payment dynamics chart renders with real data

## Inputs

- `src/lib/api-client.ts`
- `src/types/api.ts`
- `backend/routers/analytics.py`

## Expected Output

- `src/app/api/analytics/pipeline/route.ts`
- `src/app/api/analytics/dashboard/route.ts`
- `src/app/api/analytics/payment-dynamics/route.ts`

## Verification

curl http://localhost:3000/api/analytics/dashboard — returns dashboard metrics from FastAPI
