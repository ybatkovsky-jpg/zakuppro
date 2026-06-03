---
estimated_steps: 31
estimated_files: 5
skills_used: []
---

# T02: Replace Projects API Routes with FastAPI Proxy

## Why
Projects API is the core entity used throughout the app. Replacing this first establishes the pattern for other routes.

## Do
1. Replace `src/app/api/projects/route.ts`:
   - Remove Prisma imports and db usage
   - Import `apiFetch` from `@/lib/api-client`
   - For GET: Proxy to `GET http://localhost:8000/api/projects`
   - Pass query params (status, search) to FastAPI
   - Transform response: snake_case → camelCase (customerName, status mapping)
   - Handle errors from FastAPI and propagate with appropriate status

2. Replace `src/app/api/projects/[id]/route.ts`:
   - Proxy GET to `/api/projects/{id}`
   - Proxy PUT to `/api/projects/{id}`
   - Proxy DELETE to `/api/projects/{id}`
   - Transform requests/responses

3. Replace `src/app/api/projects/[id]/status/route.ts`:
   - Proxy PUT to `/api/projects/{id}` with status field
   - Map English → Russian status codes

4. Replace `src/app/api/projects/[id]/export/route.ts`:
   - Keep export logic but fetch project data via FastAPI proxy

5. Replace `src/app/api/projects/[id]/history/route.ts`:
   - This uses ProjectStatusHistory - check if FastAPI endpoint exists
   - If not, keep Prisma for now (document as TODO)

## Constraints
- Maintain existing API contract for frontend components
- Status mapping: new→Проектирование, processing→Закупки, paid→Оплачено, delivered→Доставлено
- Error responses must match current format

## Done when
- All projects routes use apiFetch instead of Prisma
- Frontend /projects page loads and displays data correctly
- Create/update/delete operations work via FastAPI

## Inputs

- `src/lib/api-client.ts`
- `src/types/api.ts`

## Expected Output

- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/projects/[id]/status/route.ts`
- `src/app/api/projects/[id]/export/route.ts`
- `src/app/api/projects/[id]/history/route.ts`

## Verification

curl http://localhost:3000/api/projects — returns data from FastAPI

## Observability Impact

API failures now originate from FastAPI. Check backend logs for root cause.
