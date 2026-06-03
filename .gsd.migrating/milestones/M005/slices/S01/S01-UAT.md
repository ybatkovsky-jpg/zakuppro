# S01: Frontend-Backend API Integration — UAT

**Milestone:** M005
**Written:** 2026-06-03T03:35:33.969Z

# S01-UAT: Frontend-Backend API Integration

## UAT Overview

**Slice**: S01 (M005)  
**Scope**: API proxy infrastructure between Next.js and FastAPI  
**UAT Type**: Infrastructure verification (component-level testing)  
**Not Proven By This UAT**: End-to-end UI functionality (deferred to S02-S04)

---

## Test Case 1: Projects API Fetch Data

**Preconditions**:
- FastAPI backend running at `http://localhost:8000`
- Next.js dev server running at `http://localhost:3000`
- Database contains at least one project

**Steps**:
1. Execute `curl http://localhost:3000/api/projects`
2. Verify response contains projects array with camelCase fields
3. Check fields: `customerName`, `totalCost`, `createdAt`, `status`

**Expected Outcomes**:
- Status: 200 OK
- Response body: JSON array with projects
- Field transformation verified: snake_case → camelCase
- Status mapping verified: Russian (Проектирование) → English (new)

**Edge Cases**:
- Empty database: returns empty array `[]`
- Backend down: returns error from FastAPI

---

## Test Case 2: Suppliers API Field Mapping

**Preconditions**:
- FastAPI backend running
- Database contains suppliers

**Steps**:
1. Execute `curl http://localhost:3000/api/suppliers`
2. Verify requisites field contains parsed phone/contactPerson/address
3. Check compatibility fields: `_count`, `projectItems`, `purchaseRequests`, `invoices`

**Expected Outcomes**:
- Status: 200 OK
- Requisites field populated with JSON-encoded contact details
- Compatibility fields present (even if empty arrays)

**Edge Cases**:
- Supplier with no requisites: returns empty object `{}`

---

## Test Case 3: Warehouse API StockItem Mapping

**Preconditions**:
- FastAPI backend running
- Database contains stock items

**Steps**:
1. Execute `curl http://localhost:3000/api/warehouse`
2. Verify field mapping: article (from sku), quantity (from qty_total)
3. Check default fields: category, minQuantity, unit, location

**Expected Outcomes**:
- Status: 200 OK
- article field matches FastAPI sku
- quantity field matches FastAPI qty_total
- Missing Prisma fields have default values

**Edge Cases**:
- Empty warehouse: returns empty array `[]`

---

## Test Case 4: Analytics Dashboard Metrics

**Preconditions**:
- FastAPI backend running
- Database contains invoice data

**Steps**:
1. Execute `curl "http://localhost:3000/api/analytics/dashboard"`
2. Verify response contains: `paidInvoicesCount`, `unpaidInvoicesCount`, `totalPaidAmount`, `totalUnpaidAmount`
3. Check field transformation from snake_case

**Expected Outcomes**:
- Status: 200 OK
- Metrics present with camelCase naming
- Amounts returned as numbers (not strings)

**Edge Cases**:
- No invoice data: returns zeros for all metrics

---

## Test Case 5: TypeScript Compilation

**Preconditions**:
- Node modules installed (`npm install` completed)

**Steps**:
1. Execute `npm run build` or `npm run type-check`
2. Verify no TypeScript errors
3. Check all API routes compiled successfully

**Expected Outcomes**:
- Exit code: 0
- No type errors in console output
- All routes listed in build output

**Edge Cases**:
- Type mismatch: build fails with error (not expected)

---

## UAT Execution Status

**Environment**: Development (WSL, Windows 11)  
**Date**: 2026-06-03  
**Runtime Backend**: Not available (deferred runtime testing)

| TC | Status | Notes |
|----|--------|-------|
| TC1 | ⏸️ Deferred | Requires FastAPI backend |
| TC2 | ⏸️ Deferred | Requires FastAPI backend |
| TC3 | ⏸️ Deferred | Requires FastAPI backend |
| TC4 | ⏸️ Deferred | Requires FastAPI backend |
| TC5 | ✅ Passed | Build verification completed |

**Overall Verdict**: Infrastructure ready for runtime testing. Code compilation verified, proxy patterns established, migration documentation complete.
