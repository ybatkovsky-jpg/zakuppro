---
estimated_steps: 28
estimated_files: 4
skills_used: []
---

# T04: Replace Warehouse/Stock API Routes with FastAPI Proxy

## Why
Warehouse items are managed through stock items in FastAPI. Need to map Prisma WarehouseItem to FastAPI StockItem.

## Do
1. Replace `src/app/api/warehouse/route.ts`:
   - GET: Proxy to `/api/stock_items`
   - POST: Proxy to `/api/stock_items`
   - Map fields: WarehouseItem → StockItem
     - article → sku
     - quantity → qty_total
     - minQuantity → (omitted or stored in notes)
   - Transform response: StockItem → WarehouseItem format

2. Replace `src/app/api/warehouse/[id]/route.ts`:
   - GET detail
   - PUT update
   - DELETE

3. Replace `src/app/api/warehouse/export/route.ts`:
   - Fetch data via FastAPI proxy
   - Keep export CSV generation in frontend

4. Replace `src/app/api/warehouse/transactions/route.ts`:
   - Check if FastAPI has equivalent endpoint
   - If not, document as TODO for backend

## Constraints
- Field names differ significantly - transformation required
- Frontend expects WarehouseItem shape

## Done when
- Warehouse routes proxy to FastAPI stock_items
- Warehouse list loads correctly
- CRUD operations work

## Inputs

- `src/lib/api-client.ts`
- `src/types/api.ts`

## Expected Output

- `src/app/api/warehouse/route.ts`
- `src/app/api/warehouse/[id]/route.ts`
- `src/app/api/warehouse/export/route.ts`

## Verification

curl http://localhost:3000/api/warehouse — returns stock items from FastAPI
