---
estimated_steps: 24
estimated_files: 2
skills_used: []
---

# T03: Replace Suppliers API Routes with FastAPI Proxy

## Why
Suppliers are used in purchase requests and invoices. Consistent proxy pattern ensures all data flows through FastAPI.

## Do
1. Replace `src/app/api/suppliers/route.ts`:
   - Remove Prisma db usage
   - GET: Proxy to `/api/suppliers` with search param
   - POST: Proxy to `/api/suppliers` with supplier data
   - Transform request body: camelCase → snake_case
   - Transform response: snake_case → camelCase

2. Replace `src/app/api/suppliers/[id]/route.ts`:
   - GET by id
   - PUT update
   - DELETE
   - All proxied to FastAPI

## Constraints
- Supplier fields differ between Prisma and FastAPI:
  - Prisma: phone, contactPerson, address (frontend expects)
  - FastAPI: requisites only
  - Map missing fields to notes or omit gracefully
- Maintain frontend compatibility

## Done when
- Suppliers routes proxy to FastAPI
- Suppliers list loads correctly
- Create/update/delete suppliers work

## Inputs

- `src/lib/api-client.ts`
- `src/types/api.ts`

## Expected Output

- `src/app/api/suppliers/route.ts`
- `src/app/api/suppliers/[id]/route.ts`

## Verification

curl http://localhost:3000/api/suppliers — returns suppliers list
