---
estimated_steps: 22
estimated_files: 3
skills_used: []
---

# T05: Replace Invoices API Routes with FastAPI Proxy

## Why
Invoices are critical for payment tracking. Verification and reconciliation depend on accurate invoice data from FastAPI.

## Do
1. Replace `src/app/api/invoices/route.ts`:
   - GET: Proxy to `/api/invoices` with projectId filter
   - POST: Proxy to `/api/invoices`
   - Transform request body with nested items

2. Replace `src/app/api/invoices/[id]/route.ts`:
   - GET detail
   - PUT update
   - DELETE

3. Replace `src/app/api/invoices/[id]/reconcile/route.ts`:
   - Check FastAPI reconciliation endpoint
   - Proxy or implement based on backend capability

## Constraints
- Invoice status is Russian in FastAPI (Ожидает сверки, Сверен, etc.)
- Frontend expects English status - add mapping
- Invoice items structure differs - transform accordingly

## Done when
- Invoices routes proxy to FastAPI
- Invoice list loads correctly
- Invoice creation works

## Inputs

- `src/lib/api-client.ts`
- `src/types/api.ts`

## Expected Output

- `src/app/api/invoices/route.ts`
- `src/app/api/invoices/[id]/route.ts`
- `src/app/api/invoices/[id]/reconcile/route.ts`

## Verification

curl http://localhost:3000/api/invoices — returns invoices from FastAPI
