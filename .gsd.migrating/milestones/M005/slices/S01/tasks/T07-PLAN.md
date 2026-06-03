---
estimated_steps: 23
estimated_files: 3
skills_used: []
---

# T07: Remove Prisma Dependencies and Cleanup

## Why
After replacing all API routes, Prisma is no longer needed. Removing unused dependencies keeps the codebase clean.

## Do
1. Remove Prisma client import from all files:
   - Search for `from '@prisma/client'` or `import { db } from '@/lib/db'`
   - Remove any remaining Prisma usage

2. Delete `src/lib/db.ts`:
   - No longer needed for API routes
   - Keep a stub if some frontend components still import it (check first)

3. Clean up package.json:
   - Remove `@prisma/client` dependency
   - Remove `prisma` dev dependency

4. Clean up Prisma files:
   - Delete `prisma/schema.prisma` (or move to backup)
   - Delete `prisma/migrations` if exists

5. Update tsconfig/next.config if any Prisma-specific config exists

## Constraints
- Verify no components directly use Prisma before removing
- Some non-API files might still import db.ts - check and update

## Done when
- No Prisma imports remain in API routes
- package.json has no Prisma dependencies
- npm install succeeds without errors

## Inputs

- `src/app/api/**/*.ts`

## Expected Output

- `package.json`

## Verification

! grep -r '@prisma/client' src/app/api/ — no Prisma imports in API routes; npm install — succeeds
