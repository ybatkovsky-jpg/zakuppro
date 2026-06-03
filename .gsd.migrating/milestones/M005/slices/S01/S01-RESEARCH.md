# Slice S01 Research: Frontend-Backend API Integration

## Summary

This slice research focuses on integrating the Next.js frontend with the FastAPI backend. Currently, the frontend uses Prisma ORM to access PostgreSQL directly, while FastAPI provides a RESTful API with full CRUD operations for all entities. The task is to migrate frontend data access from Prisma to FastAPI endpoints via Next.js API route proxies.

**Calibrated Depth: Light Research** - The technology stack is established (Next.js, FastAPI, TypeScript/Python). The integration follows standard REST API proxying patterns already present in the codebase. The main work is replacing Prisma calls with HTTP fetch calls through Next.js API routes that proxy to FastAPI.

---

## Key Findings

### 1. Current State Analysis

#### Frontend (Next.js)
- Uses Prisma ORM with direct database access (`src/lib/db.ts`)
- All API routes under `src/app/api/` use Prisma for data operations
- Components fetch data via `/api/*` endpoints (e.g., `/api/projects`, `/api/suppliers`, `/api/warehouse`)
- Current API pattern:
  ```typescript
  // src/app/api/projects/route.ts
  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: { ... }, _count: { ... } },
  })
  ```

#### Backend (FastAPI)
- Fully functional REST API at `http://localhost:8000`
- All CRUD endpoints implemented in `backend/routers/`:
  - `projects.py` - GET /, GET /{id}, POST /, PUT /{id}, DELETE /{id}
  - `project_items.py` - Full CRUD for project items
  - `suppliers.py`, `stock_items.py`, `purchase_orders.py`, `invoices.py`, `payments.py`, `analytics.py`
- CORS already configured for `localhost:3000` and `localhost:5173`
- Pydantic v2 schemas with `from_attributes=True` for ORM mode
- Analytics endpoints exist: `/api/analytics/dashboard`, `/api/analytics/payment-dynamics`

#### Docker Infrastructure
- PostgreSQL container on port 5432
- FastAPI container on port 8000
- JWT auth environment variables configured (`SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`)
- No JWT implementation exists yet (auth only via Telegram bot `ALLOWED_CHAT_IDS`)

### 2. Integration Architecture

#### Decision MEM092
FastAPI is the single source of truth for data. Next.js API routes proxy requests to FastAPI without business logic.

**Rationale**: Avoid duplicating business logic between frontend and backend. Future frontend changes won't affect backend.

**Implementation Pattern**:
```typescript
// Next.js API Route (proxy)
export async function GET(request: NextRequest) {
  const response = await fetch('http://localhost:8000/api/projects')
  const data = await response.json()
  return NextResponse.json(data)
}
```

### 3. Type System Requirements

FastAPI uses Pydantic schemas; frontend needs TypeScript types. Two approaches:

**Option A (Recommended)**: Generate TypeScript types from FastAPI OpenAPI schema
- FastAPI auto-generates OpenAPI spec at `/docs` or `/openapi.json`
- Tools like `openapi-typescript` can generate TS types
- One-time generation or build-time script

**Option B**: Manually maintain TypeScript types matching Pydantic schemas
- Prone to drift; requires manual sync

### 4. Authentication & Authorization

#### Current Auth State
- Telegram Bot: `ALLOWED_CHAT_IDS` environment variable (Telegram only)
- JWT variables configured in docker-compose but NOT implemented
- No `backend/routers/auth.py` or JWT middleware exists

#### RBAC Requirements (Decision MEM094)
Roles stored in JWT token claim:
- `owner`: full access
- `manager`: own projects only
- `warehouse`: warehouse only

**Implication for S01**: JWT auth middleware must be implemented in FastAPI before RBAC can work. This is a **blocker** for S04 (RBAC slice) but **out of scope** for S01 (S01 can proceed with no auth).

### 5. Identified Files to Change

#### Frontend Files (Replace Prisma with API calls)
1. `src/app/api/projects/route.ts` - Proxy to FastAPI `/api/projects`
2. `src/app/api/suppliers/route.ts` - Proxy to FastAPI `/api/suppliers`
3. `src/app/api/warehouse/route.ts` - Proxy to FastAPI `/api/stock_items`
4. `src/app/api/invoices/route.ts` - Proxy to FastAPI `/api/invoices`
5. `src/app/api/analytics/pipeline/route.ts` - Proxy to FastAPI `/api/analytics/dashboard`
6. `src/app/api/analytics/suppliers/route.ts` - May need new FastAPI endpoint
7. `src/lib/db.ts` - Can be removed or replaced with API client utilities

#### New Files to Create
1. `src/lib/api-client.ts` - Centralized HTTP client with error handling, type assertions
2. `src/types/api.ts` - TypeScript types matching FastAPI schemas

#### Backend Files (Potential additions)
1. `backend/routers/auth.py` - JWT token generation/validation (future, not S01)
2. Update `backend/main.py` CORS if needed for production origins

### 6. Mapping: Prisma → FastAPI Endpoints

| Entity | Prisma Model | FastAPI Endpoint |
|--------|--------------|------------------|
| Project | `db.project.findMany()` | `GET /api/projects` |
| Project Detail | `db.project.findUnique()` | `GET /api/projects/{id}` |
| Project Items | `db.projectItem.findMany()` | `GET /api/project-items` |
| Suppliers | `db.supplier.findMany()` | `GET /api/suppliers` |
| Stock Items | `db.stockItem.findMany()` | `GET /api/stock_items` |
| Invoices | `db.invoice.findMany()` | `GET /api/invoices` |
| Analytics | Custom queries | `GET /api/analytics/dashboard` |

### 7. Dependencies

#### Existing
- Next.js 16.1.1
- `@tanstack/react-query` for data fetching
- Prisma Client (will be removed)

#### To Add
- None required for basic proxying (native `fetch`)
- Optional: `axios` for better error handling, or native `fetch` suffices
- Optional: `openapi-typescript` for type generation

---

## Constraints & Considerations

1. **Status Field Mismatch**: 
   - Frontend uses English status codes (`new`, `processing`, `paid`, `delivered`)
   - Backend uses Russian status strings (`Проектирование`, `Закупки`, `Оплачено`, `Доставлено`)
   - **Action**: Map between status values in proxy layer or normalize in backend

2. **Field Name Differences**:
   - Frontend: `customerName`, `createdAt`
   - Backend: `client`, `created_at`
   - **Action**: Transform in proxy layer or generate correct types

3. **Pagination**:
   - FastAPI uses `skip`/`limit` query params
   - Frontend currently uses Prisma's pagination
   - **Action**: Update API calls to pass `skip`/`limit`

4. **Nested Relationships**:
   - FastAPI `ProjectResponse` includes `items: List[ProjectItemResponse]` via `lazy="selectin"`
   - Frontend expects similar structure
   - **Action**: Verify response shape matches frontend expectations

---

## Recommendations

### 1. Implementation Sequence

1. **Create API Client Utility** (`src/lib/api-client.ts`)
   - Wrapper around `fetch` with base URL, error handling, timeout
   - Functions for each endpoint type
   - Type assertions using generated TypeScript types

2. **Generate TypeScript Types**
   - Fetch FastAPI OpenAPI spec from `http://localhost:8000/openapi.json`
   - Run `openapi-typescript` to generate `src/types/api.ts`
   - Manual review for status/field mappings

3. **Replace API Routes One by One**
   - Start with read-only endpoints (GET)
   - Move to write operations (POST, PUT, DELETE)
   - Verify each component still works

4. **Remove Prisma Dependencies**
   - Delete `src/lib/db.ts`
   - Remove `@prisma/client` from `package.json`
   - Clean up any remaining Prisma references

### 2. Verification Strategy

After integration:
```bash
# 1. Start FastAPI backend
cd backend && uvicorn backend.main:app --reload

# 2. Start Next.js frontend
npm run dev

# 3. Test endpoints
curl http://localhost:3000/api/projects  # Should proxy to FastAPI
curl http://localhost:8000/api/projects  # Direct FastAPI call

# 4. Compare responses
diff <(curl -s localhost:3000/api/projects) <(curl -s localhost:8000/api/projects)
```

### 3. Out of Scope (Future Slices)

- JWT authentication implementation (S04)
- RBAC middleware (S04)
- Role-based data filtering (S04)
- WebSocket support (not planned)

---

## Sources

- FastAPI docs: https://fastapi.tiangolo.com/
- OpenAPI typescript: https://openapi-ts.pages.dev/
- Next.js API routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Decision MEM092 (D029): FastAPI как единственный источник данных
- Decision MEM094 (D031): RBAC с JWT токенами

---

## Implementation Landscape

### Natural Work Units

1. **API Client Foundation** - Create HTTP client utility with types
2. **Type Generation** - Generate TypeScript types from OpenAPI spec
3. **Projects API Proxy** - Replace `/api/projects` route
4. **Suppliers API Proxy** - Replace `/api/suppliers` route
5. **Warehouse/Stock API Proxy** - Replace `/api/warehouse` route
6. **Invoices API Proxy** - Replace `/api/invoices` route
7. **Analytics API Proxy** - Replace `/api/analytics/*` routes
8. **Cleanup** - Remove Prisma dependencies

### First Proof

**Recommended starting point**: `src/app/api/projects/route.ts`
- Projects is the core entity
- Already has simple CRUD structure
- FastAPI endpoint is tested and working
- Immediate visibility if proxy works (projects list in UI)

### Files by Purpose

**Proxy Routes** (8 files):
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/projects/[id]/status/route.ts`
- `src/app/api/suppliers/route.ts`
- `src/app/api/suppliers/[id]/route.ts`
- `src/app/api/warehouse/route.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/analytics/pipeline/route.ts`

**Infrastructure** (2 files):
- `src/lib/api-client.ts` (new)
- `src/types/api.ts` (new)

**Cleanup** (2 files):
- `src/lib/db.ts` (remove)
- `package.json` (remove Prisma)

**Verification** (1 script):
- `scripts/test-api-proxy.sh` (new, optional)

---

## Gotchas

1. **CORS in Production**: `localhost:3000` is allowed in FastAPI CORS, but production origins need to be added
2. **Snake Case vs Camel Case**: Backend uses `created_at`, frontend expects `createdAt`. Transform in proxy.
3. **Date Formats**: Python `datetime` vs JavaScript `Date`. JSON serialization handles this, but verify timezone handling.
4. **Decimal Precision**: Financial amounts use PostgreSQL `NUMERIC(12,2)`. JavaScript numbers are floats - consider string representation for currency.
5. **Status Enum Mismatch**: English vs Russian status codes need mapping layer.