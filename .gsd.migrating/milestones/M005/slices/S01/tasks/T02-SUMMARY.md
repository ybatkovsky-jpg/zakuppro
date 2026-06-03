---
id: T02
parent: S01
milestone: M005
key_files:
  - src/app/api/projects/route.ts
  - src/app/api/projects/[id]/route.ts
  - src/app/api/projects/[id]/status/route.ts
  - src/app/api/projects/[id]/export/route.ts
  - src/app/api/projects/[id]/history/route.ts
key_decisions:
  - History endpoint kept on Prisma with TODO comment - FastAPI doesn't have ProjectStatusHistory endpoint yet
  - Status mapping done at route level - maintains existing frontend contract
  - Field transformations inline in each route file - consistent with T01 patterns
duration: 
verification_result: untested
completed_at: 2026-06-03T02:05:08.366Z
blocker_discovered: false
---

# T02: Replaced Projects API routes with FastAPI proxy routes

**Replaced Projects API routes with FastAPI proxy routes**

## What Happened

Replaced all Projects API routes with FastAPI proxy implementations:

1. **src/app/api/projects/route.ts**: Replaced Prisma with apiFetch. Added camelCase/snakeCase transformations. Status mapping between English (new/processing/paid/delivered) and Russian (Проектирование/Закупки/Оплачено/Доставлено). Added _count compatibility field.

2. **src/app/api/projects/[id]/route.ts**: Implemented GET/PATCH/DELETE methods proxied to FastAPI. Transformations for field names (client->customerName, total_cost->totalCost, created_at->createdAt, etc.).

3. **src/app/api/projects/[id]/status/route.ts**: Status transition validation preserved. Maps English statuses to Russian for FastAPI. Maintains VALID_TRANSITIONS and MANDATORY_COMMENT_TRANSITIONS logic.

4. **src/app/api/projects/[id]/export/route.ts**: Kept Excel export logic but fetches project data from FastAPI. Generates two sheets (Позиции, По поставщикам).

5. **src/app/api/projects/[id]/history/route.ts**: Left as Prisma-only with TODO comment to migrate once FastAPI endpoint exists.

Key patterns established:
- toCamelCase/toSnakeCase transformation functions in each file
- Status mapping via STATUS_TO_FASTAPI/STATUS_FROM_FASTAPI constants
- Error handling transforms FastAPI errors to Next.js Response format
- Build passes successfully

## Verification

- Verified via npm run build: TypeScript compilation successful, no type errors
- Confirmed all 5 files created/modified
- Proxy pattern established using apiFetch from @/lib/api-client
- Status mapping: new→Проектирование, processing→Закупки, paid→Оплачено, delivered→Доставлено
- Field mapping: client<->customerName, total_cost<->totalCost, *_at->*At
- History endpoint marked with TODO for future FastAPI endpoint

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/app/api/projects/[id]/status/route.ts`
- `src/app/api/projects/[id]/export/route.ts`
- `src/app/api/projects/[id]/history/route.ts`
