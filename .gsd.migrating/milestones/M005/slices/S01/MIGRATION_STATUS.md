# API Migration Status: Prisma → FastAPI

**Slice**: M005/S01 - Frontend-Backend API Integration
**Generated**: 2026-06-03
**Purpose**: Track which API routes have been migrated to FastAPI proxy and which remain on Prisma

## Summary

| Category | Count | Status |
|----------|-------|--------|
| **Migrated to FastAPI** | 8 routes | ✅ Complete |
| **Kept on Prisma (intentional)** | 5 routes | ⚠️ blockers documented |
| **Out of slice scope** | 14 routes | 🔄 Future work |
| **Total** | 27 routes with Prisma | - |

---

## 1. Migrated to FastAPI Proxy ✅

These routes proxy all requests to FastAPI backend (`http://localhost:8000`).

| Route | File | Task | Notes |
|-------|------|------|-------|
| GET/POST `/api/projects` | `src/app/api/projects/route.ts` | T02 | Status mapping: new→Проектирование, etc. |
| GET/PATCH/DELETE `/api/projects/[id]` | `src/app/api/projects/[id]/route.ts` | T02 | Field mapping: client→customerName |
| POST `/api/projects/[id]/status` | `src/app/api/projects/[id]/status/route.ts` | T02 | Status transition validation preserved |
| GET `/api/projects/[id]/export` | `src/app/api/projects/[id]/export/route.ts` | T02 | Excel export with FastAPI data |
| GET/POST `/api/suppliers` | `src/app/api/suppliers/route.ts` | T03 | Full CRUD proxy |
| GET/PATCH/DELETE `/api/suppliers/[id]` | `src/app/api/suppliers/[id]/route.ts` | T03 | Single supplier proxy |
| GET/POST `/api/warehouse` | `src/app/api/warehouse/route.ts` | T04 | Maps to StockItem (article→sku) |
| GET/PATCH/DELETE `/api/warehouse/[id]` | `src/app/api/warehouse/[id]/route.ts` | T04 | StockItem detail proxy |
| GET `/api/warehouse/export` | `src/app/api/warehouse/export/route.ts` | T04 | Excel export via FastAPI |
| GET `/api/analytics/dashboard` | `src/app/api/analytics/dashboard/route.ts` | T06 | Metrics from FastAPI |
| GET `/api/analytics/payment-dynamics` | `src/app/api/analytics/payment-dynamics/route.ts` | T06 | Time series data from FastAPI |

---

## 2. Kept on Prisma (Intentional) ⚠️

These routes remain on Prisma due to documented blockers.

| Route | File | Blocker | Migration Path |
|-------|------|---------|---------------|
| GET `/api/projects/[id]/history` | `src/app/api/projects/[id]/history/route.ts` | No FastAPI ProjectStatusHistory endpoint | Add endpoint to FastAPI backend |
| GET/POST `/api/invoices` | `src/app/api/invoices/route.ts` | **Architectural mismatch**: FastAPI Invoice links to `purchase_order_id`, Prisma Invoice links directly to `projectId`/`supplierId` | Requires frontend schema changes to adopt PurchaseOrder pattern; needs ID synchronization between Prisma CUIDs and FastAPI integers |
| GET/PATCH/DELETE `/api/invoices/[id]` | `src/app/api/invoices/[id]/route.ts` | Same as above | Same as above |
| POST `/api/invoices/[id]/reconcile` | `src/app/api/invoices/[id]/reconcile/route.ts` | FastAPI InvoiceVerifier is internal service, not exposed via REST | Expose reconciliation endpoint in FastAPI |
| GET `/api/analytics/pipeline` | `src/app/api/analytics/pipeline/route.ts` | No FastAPI equivalent for ProjectItem status aggregation | Add `/api/analytics/pipeline` to FastAPI |
| GET `/api/analytics/suppliers` | `src/app/api/analytics/suppliers/route.ts` | No FastAPI equivalent for supplier metrics aggregation | Add `/api/analytics/suppliers` to FastAPI |
| GET/POST `/api/warehouse/transactions` | `src/app/api/warehouse/transactions/route.ts` | No FastAPI StockMovement endpoint | Add StockMovement model and endpoints to FastAPI |

### Invoice Migration Blocker Details

The Prisma Invoice model and FastAPI Invoice model have fundamental architectural differences:

**Prisma Invoice** (current frontend):
- Direct links: `projectId: string`, `supplierId: string`
- Fields: `invoiceNumber`, `totalAmount`, `paidAt`, `notes`
- Status: English (`received`, `verified`, `discrepancy`, `approved`, `paid`, `cancelled`)

**FastAPI Invoice** (backend):
- Link: `purchase_order_id: integer`
- Additional fields: `file_url`, `raw_text`, `verification_result` (OCR-related)
- Status: Russian (`Ожидает сверки`, `Сверен`, `Ошибки`, `Ожидает оплаты`, `Оплачен`, `Отменен`)

**Migration Requirements**:
1. Frontend changes to use PurchaseOrder instead of direct Project/Supplier links
2. ID synchronization between Prisma string CUIDs and FastAPI integer IDs
3. Field mapping between different schemas
4. Reconciliation endpoint exposed in FastAPI

---

## 3. Out of Slice Scope 🔄

These routes use Prisma but were not part of M005/S01 tasks. They need migration in future slices.

| Route | File | Purpose | TODO Status |
|-------|------|---------|-------------|
| GET `/api/stats` | `src/app/api/stats/route.ts` | General statistics | ⚠️ Needs TODO |
| GET/POST `/api/notifications` | `src/app/api/notifications/route.ts` | User notifications | ⚠️ Needs TODO |
| GET/POST `/api/deliveries` | `src/app/api/deliveries/route.ts` | Delivery tracking | ⚠️ Needs TODO |
| GET/PATCH `/api/deliveries/[id]` | `src/app/api/deliveries/[id]/route.ts` | Delivery detail | ⚠️ Needs TODO |
| GET/POST `/api/requests` | `src/app/api/requests/route.ts` | Purchase requests | ⚠️ Needs TODO |
| GET/PATCH/DELETE `/api/requests/[id]` | `src/app/api/requests/[id]/route.ts` | Request detail | ⚠️ Needs TODO |
| POST `/api/requests/[id]/send-email` | `src/app/api/requests/[id]/send-email/route.ts` | Request email | ⚠️ Needs TODO |
| GET `/api/reports` | `src/app/api/reports/route.ts` | Reports generation | ⚠️ Needs TODO |
| GET `/api/search` | `src/app/api/search/route.ts` | Global search | ⚠️ Needs TODO |
| GET/POST `/api/company` | `src/app/api/company/route.ts` | Company settings | ⚠️ Needs TODO |
| GET/POST `/api/automation` | `src/app/api/automation/route.ts` | Automation rules | ⚠️ Needs TODO |
| POST `/api/automation/execute` | `src/app/api/automation/execute/route.ts` | Execute automation | ⚠️ Needs TODO |
| GET `/api/activity` | `src/app/api/activity/route.ts` | Activity feed | ⚠️ Needs TODO |
| POST `/api/email/send` | `src/app/api/email/send/route.ts` | Send email | ⚠️ Needs TODO |
| GET/POST `/api/email/inbox` | `src/app/api/email/inbox/route.ts` | Email inbox processing | ⚠️ Needs TODO |
| GET `/api/email-logs` | `src/app/api/email-logs/route.ts` | Email logs | ⚠️ Needs TODO |
| PATCH `/api/settings/telegram` | `src/app/api/settings/telegram/route.ts` | Telegram settings | ⚠️ Needs TODO |
| PATCH `/api/settings/email` | `src/app/api/settings/email/route.ts` | Email settings | ⚠️ Needs TODO |
| PATCH `/api/settings/ai` | `src/app/api/settings/ai/route.ts` | AI settings | ⚠️ Needs TODO |
| POST `/api/seed` | `src/app/api/seed/route.ts` | Database seeding | ⚠️ Needs TODO |

---

## 4. Prisma Dependencies

As of 2026-06-03, the following Prisma dependencies remain:

**package.json**:
```json
{
  "dependencies": {
    "@prisma/client": "^6.11.1"
  },
  "dependencies": {
    "prisma": "^6.11.1"
  }
}
```

**Scripts** (can be removed when Prisma is fully removed):
```json
{
  "db:push": "prisma db push",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:reset": "prisma migrate reset"
}
```

**Files**:
- `src/lib/db.ts` - Prisma client export (used by 27 API routes)
- `prisma/schema.prisma` - Database schema
- `prisma/migrations/` - Database migrations

---

## 5. Next Steps

To fully migrate to FastAPI:

1. **Add missing FastAPI endpoints**:
   - `ProjectStatusHistory` for `/api/projects/[id]/history`
   - `StockMovement` for `/api/warehouse/transactions`
   - `/api/analytics/pipeline` for ProjectItem status aggregation
   - `/api/analytics/suppliers` for supplier metrics

2. **Resolve Invoice architectural mismatch**:
   - Design PurchaseOrder workflow
   - Update frontend to use PurchaseOrder pattern
   - Implement ID synchronization (CUID ↔ integer)

3. **Migrate out-of-scope routes**:
   - Plan FastAPI equivalents for each
   - Prioritize by usage/impact

4. **Remove Prisma**:
   - Only after all routes have FastAPI equivalents
   - Keep `prisma/` directory for reference during migration
