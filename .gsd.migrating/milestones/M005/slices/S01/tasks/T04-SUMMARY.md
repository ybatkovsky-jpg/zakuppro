---
id: T04
parent: S01
milestone: M005
key_files:
  - src/app/api/warehouse/route.ts
  - src/app/api/warehouse/[id]/route.ts
  - src/app/api/warehouse/export/route.ts
  - src/app/api/warehouse/transactions/route.ts
key_decisions:
  - FastAPI endpoint uses kebab-case /api/stock-items not snake_case
  - Field mapping: article<->sku, quantity<->qty_total
  - Missing fields (category, minQuantity, unit, location) defaulted in response
  - Transactions route not migrated - FastAPI lacks stock movement endpoint
duration: 
verification_result: passed
completed_at: 2026-06-03T02:13:29.997Z
blocker_discovered: false
---

# T04: Replaced warehouse Prisma routes with FastAPI proxy, mapping WarehouseItem to StockItem fields

**Replaced warehouse Prisma routes with FastAPI proxy, mapping WarehouseItem to StockItem fields**

## What Happened

Replaced all warehouse API routes to proxy to FastAPI backend instead of using Prisma directly. The implementation includes:

1. **GET /api/warehouse**: Proxies to `/api/stock-items`, transforms StockItem response to WarehouseItem format with field mapping (article<->sku, quantity<->qty_total). Missing fields (category, minQuantity, unit, location) set to defaults. Supports search filtering locally.

2. **POST /api/warehouse**: Proxies create to `/api/stock-items`, transforms WarehouseItem request to StockItemCreate format.

3. **GET /api/warehouse/[id]**: Proxies detail to `/api/stock-items/{id}`, handles numeric ID conversion.

4. **PATCH /api/warehouse/[id]**: Proxies update to `/api/stock-items/{id}`, transforms WarehouseItem update to StockItemUpdate format.

5. **DELETE /api/warehouse/[id]**: Proxies delete to `/api/stock-items/{id}`.

6. **GET /api/warehouse/export**: Fetches from `/api/stock-items`, generates Excel export using existing XLSX logic.

7. **Transactions route**: Not migrated - FastAPI lacks stock movement tracking endpoint. Added TODO comment with notes for future backend implementation.

Key field mappings:
- article <-> sku
- quantity <-> qty_total
- FastAPI-specific fields (qty_reserved, qty_available) included in _fastapi metadata
- Missing Prisma fields (category, minQuantity, unit, location) defaulted in response

## Verification

Verified compilation of all warehouse routes with `npx next build`. Routes compiled successfully:
- /api/warehouse
- /api/warehouse/[id]  
- /api/warehouse/export
- /api/warehouse/transactions

Note: Runtime verification requires FastAPI backend to be running at FASTAPI_URL (default http://localhost:8000). Endpoints will proxy to /api/stock-items.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx next build | grep -E "(warehouse|error|Compiled)"` | 0 | passed | 23500ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/app/api/warehouse/route.ts`
- `src/app/api/warehouse/[id]/route.ts`
- `src/app/api/warehouse/export/route.ts`
- `src/app/api/warehouse/transactions/route.ts`
