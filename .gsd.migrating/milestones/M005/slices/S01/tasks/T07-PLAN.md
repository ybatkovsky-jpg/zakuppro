---
estimated_steps: 28
estimated_files: 2
skills_used: []
---

# T07: Document Prisma Migration Status and Cleanup

Document which API routes successfully migrated to FastAPI and which remain on Prisma with reasons. Add TODO comments to any remaining Prisma routes lacking migration notes. Remove unused Prisma imports where safe.

## Current State Analysis

After T01-T06, the following routes were converted:
- **Projects** (main routes) → FastAPI proxy ✓
- **Suppliers** → FastAPI proxy ✓  
- **Warehouse** (main routes) → FastAPI proxy ✓
- **Analytics dashboard/payment-dynamics** → FastAPI proxy ✓

The following remain on Prisma (intentionally):
- **Invoices** - architectural mismatch (T05 decision)
- **Analytics pipeline/suppliers** - no FastAPI endpoint (T06 decision)
- **Projects history** - no FastAPI ProjectStatusHistory endpoint (T02 decision)
- **Warehouse transactions** - no FastAPI StockMovement endpoint

Routes out of slice scope (not part of T01-T06):
- notifications, email-logs, email/*, settings/*, deliveries/*, search, stats, requests/*, reports, company, automation/*, activity, seed

## Task Steps

1. **Create MIGRATION_STATUS.md** documenting:
   - All API routes and current backend (Prisma/FastAPI)
   - Reason for any Prisma dependencies
   - Migration requirements for future work

2. **Add TODO comments** to Prisma routes lacking migration notes:
   - warehouse/transactions - add note about missing StockMovement endpoint
   - All out-of-scope routes - add "Not in M005/S01 scope" note

3. **Clean up what's possible**:
   - Verify all successfully migrated routes have no Prisma imports
   - Remove any stray Prisma imports from non-API files if safe

## Deliverables

- `.gsd/milestones/M005/slices/S01/MIGRATION_STATUS.md`
- TODO comments on all Prisma-using API routes

## Inputs

- `Grep results from src/app/api`
- `Task summaries T01-T06`

## Expected Output

- `MIGRATION_STATUS.md`
- `TODO comments on Prisma routes`

## Verification

1. Check MIGRATION_STATUS.md exists and lists all routes
2. grep -c "TODO.*FastAPI\|TODO.*M005.*scope" src/app/api/**/route.ts
