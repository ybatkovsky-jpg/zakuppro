# S01: Frontend-Backend API Integration

**Goal:** Replace Prisma-based Next.js API routes with FastAPI proxy routes. Frontend components will fetch data through Next.js API routes that proxy to FastAPI backend on port 8000.
**Demo:** Frontend компоненты (Projects, Invoices, Analytics) получают данные через FastAPI endpoints. Проверяется curl-ом к /api/projects, /api/invoices, /api/analytics/dashboard.

## Must-Haves

- 1. All CRUD operations (projects, suppliers, warehouse, invoices, analytics) flow through FastAPI backend
- 2. Next.js API routes are pure proxies without business logic
- 3. TypeScript types matching FastAPI schemas are available
- 4. curl to localhost:3000/api/* returns data from FastAPI
- 5. No Prisma calls remain in API routes

## Proof Level

- This slice proves: integration

## Integration Closure

Frontend components continue using /api/* endpoints internally. Data flows: Component → Next.js API route → FastAPI → PostgreSQL. Remaining work for M005: S02 (Kanban DnD), S03 (Analytics dashboard), S04 (RBAC), S05 (Production Polish).

## Verification

- API proxy failures will return FastAPI error responses. Failed requests from frontend can be traced through Next.js logs to FastAPI logs. No new observability surfaces added in this slice.

## Tasks

- [x] **T01: Create API Client Utility and TypeScript Types** `est:2h`
  ## Why
  Need centralized HTTP client for FastAPI communication and TypeScript types matching backend Pydantic schemas.
  - Files: `src/lib/api-client.ts`, `src/types/api.ts`
  - Verify: npm run type-check — verify TypeScript compilation

- [x] **T02: Replace Projects API Routes with FastAPI Proxy** `est:2h`
  ## Why
  Projects API is the core entity used throughout the app. Replacing this first establishes the pattern for other routes.
  - Files: `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/status/route.ts`, `src/app/api/projects/[id]/export/route.ts`, `src/app/api/projects/[id]/history/route.ts`
  - Verify: curl http://localhost:3000/api/projects — returns data from FastAPI

- [x] **T03: Replace Suppliers API Routes with FastAPI Proxy** `est:1h`
  ## Why
  Suppliers are used in purchase requests and invoices. Consistent proxy pattern ensures all data flows through FastAPI.
  - Files: `src/app/api/suppliers/route.ts`, `src/app/api/suppliers/[id]/route.ts`
  - Verify: curl http://localhost:3000/api/suppliers — returns suppliers list

- [x] **T04: Replace Warehouse/Stock API Routes with FastAPI Proxy** `est:1.5h`
  ## Why
  Warehouse items are managed through stock items in FastAPI. Need to map Prisma WarehouseItem to FastAPI StockItem.
  - Files: `src/app/api/warehouse/route.ts`, `src/app/api/warehouse/[id]/route.ts`, `src/app/api/warehouse/export/route.ts`, `src/app/api/warehouse/transactions/route.ts`
  - Verify: curl http://localhost:3000/api/warehouse — returns stock items from FastAPI

- [x] **T05: Replace Invoices API Routes with FastAPI Proxy** `est:1.5h`
  ## Why
  Invoices are critical for payment tracking. Verification and reconciliation depend on accurate invoice data from FastAPI.
  - Files: `src/app/api/invoices/route.ts`, `src/app/api/invoices/[id]/route.ts`, `src/app/api/invoices/[id]/reconcile/route.ts`
  - Verify: curl http://localhost:3000/api/invoices — returns invoices from FastAPI

- [x] **T06: Replace Analytics API Routes with FastAPI Proxy** `est:1h`
  ## Why
  Analytics dashboard needs real metrics from FastAPI for financial visibility.
  - Files: `src/app/api/analytics/pipeline/route.ts`, `src/app/api/analytics/suppliers/route.ts`, `src/app/api/analytics/dashboard/route.ts`, `src/app/api/analytics/payment-dynamics/route.ts`
  - Verify: curl http://localhost:3000/api/analytics/dashboard — returns dashboard metrics from FastAPI

- [ ] **T07: Remove Prisma Dependencies and Cleanup** `est:1h`
  ## Why
  After replacing all API routes, Prisma is no longer needed. Removing unused dependencies keeps the codebase clean.
  - Files: `src/lib/db.ts`, `package.json`, `prisma/schema.prisma`
  - Verify: ! grep -r '@prisma/client' src/app/api/ — no Prisma imports in API routes; npm install — succeeds

## Files Likely Touched

- src/lib/api-client.ts
- src/types/api.ts
- src/app/api/projects/route.ts
- src/app/api/projects/[id]/route.ts
- src/app/api/projects/[id]/status/route.ts
- src/app/api/projects/[id]/export/route.ts
- src/app/api/projects/[id]/history/route.ts
- src/app/api/suppliers/route.ts
- src/app/api/suppliers/[id]/route.ts
- src/app/api/warehouse/route.ts
- src/app/api/warehouse/[id]/route.ts
- src/app/api/warehouse/export/route.ts
- src/app/api/warehouse/transactions/route.ts
- src/app/api/invoices/route.ts
- src/app/api/invoices/[id]/route.ts
- src/app/api/invoices/[id]/reconcile/route.ts
- src/app/api/analytics/pipeline/route.ts
- src/app/api/analytics/suppliers/route.ts
- src/app/api/analytics/dashboard/route.ts
- src/app/api/analytics/payment-dynamics/route.ts
- src/lib/db.ts
- package.json
- prisma/schema.prisma
