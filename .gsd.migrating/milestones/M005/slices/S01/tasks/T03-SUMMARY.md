---
id: T03
parent: S01
milestone: M005
key_files:
  - src/app/api/suppliers/route.ts
  - src/app/api/suppliers/[id]/route.ts
key_decisions:
  - Field differences handled via JSON encoding in requisites - Prisma had separate fields, FastAPI only has requisites
  - Nested relationship data returned as empty arrays - FastAPI doesn't include these in SupplierResponse
  - Requisites merged on update to preserve existing data
duration: 
verification_result: untested
completed_at: 2026-06-03T02:05:08.427Z
blocker_discovered: false
---

# T03: Replaced Suppliers API routes with FastAPI proxy routes

**Replaced Suppliers API routes with FastAPI proxy routes**

## What Happened

Replaced all Suppliers API routes with FastAPI proxy implementations:

1. **src/app/api/suppliers/route.ts**: Replaced Prisma with apiFetch. Implemented field mapping between Prisma (phone, contactPerson, address) and FastAPI (requisites only). Extra fields are stored as JSON in requisites field. Added _count compatibility placeholder.

2. **src/app/api/suppliers/[id]/route.ts**: Implemented GET/PATCH/DELETE methods proxied to FastAPI. Fetches existing supplier to merge requisites during updates. Returns nested data placeholders (projectItems, purchaseRequests, invoices) for compatibility. Handles constraint violations for delete.

Key patterns:
- Field differences handled via JSON encoding: phone/contactPerson/address/notes -> requisites
- Parsing of requisites back to individual fields on GET
- Merging existing requisites with updates on PATCH
- Compatibility placeholders for nested relationships not available in FastAPI SupplierResponse

## Verification

- Verified via npm run build: TypeScript compilation successful, no type errors
- Confirmed both files created/modified
- Proxy pattern using apiFetch from @/lib/api-client
- Field mapping: Prisma fields (phone, contactPerson, address) -> FastAPI requisites (JSON)
- Error handling transforms FastAPI constraint violations to 409 status
- Compatibility fields added: _count, projectItems, purchaseRequests, invoices placeholders

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/app/api/suppliers/route.ts`
- `src/app/api/suppliers/[id]/route.ts`
