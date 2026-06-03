---
estimated_steps: 30
estimated_files: 2
skills_used: []
---

# T01: Create API Client Utility and TypeScript Types

## Why
Need centralized HTTP client for FastAPI communication and TypeScript types matching backend Pydantic schemas.

## Do
1. Create `src/lib/api-client.ts` with:
   - `FASTAPI_BASE_URL` constant (http://localhost:8000)
   - `apiFetch()` wrapper around native fetch with error handling
   - Helper methods: `getProjects()`, `getProject(id)`, `createProject()`, `updateProject()`, `deleteProject()`
   - Similar methods for suppliers, stockItems, invoices, analytics
   - Timeout handling (default 10s)
   - Response JSON parsing with error propagation

2. Create `src/types/api.ts` with TypeScript interfaces matching FastAPI schemas:
   - `Project`, `ProjectCreate`, `ProjectUpdate`, `ProjectResponse`
   - `ProjectItem`, `ProjectItemCreate`, `ProjectItemResponse`
   - `Supplier`, `SupplierCreate`, `SupplierUpdate`, `SupplierResponse`
   - `StockItem`, `StockItemCreate`, `StockItemUpdate`, `StockItemResponse`
   - `Invoice`, `InvoiceCreate`, `InvoiceResponse`
   - `DashboardMetrics`, `PaymentDynamicsPoint`
   - Note: Use camelCase for frontend (createdAt, updatedAt) to match current frontend expectations

3. Field mapping notes in api-client:
   - Backend uses snake_case (created_at, client), frontend expects camelCase (createdAt, customerName)
   - Add transform functions in api-client to convert between formats
   - Backend status is Russian (Проектирование), frontend uses English (new) - add status mapping

## Constraints
- Use native fetch (no new dependencies)
- Types should be manually written to match backend schemas exactly
- Handle 404, 500 errors gracefully

## Done when
- `src/lib/api-client.ts` exists with all helper methods
- `src/types/api.ts` exists with complete type definitions
- TypeScript compiles without errors

## Inputs

- `backend/schemas.py`

## Expected Output

- `src/lib/api-client.ts`
- `src/types/api.ts`

## Verification

npm run type-check — verify TypeScript compilation
