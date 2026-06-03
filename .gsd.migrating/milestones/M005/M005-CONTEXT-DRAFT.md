# M005: Frontend UI Integration

**Gathered:** 2026-06-03
**Status:** Interview in progress

## Investigation Notes

### Existing Frontend Structure
- Next.js 16.1.1 with App Router
- Shadcn UI components (Radix UI primitives)
- Prisma with SQLite for mock data
- Existing API routes: projects, suppliers, warehouse, invoices, analytics, etc.
- @dnd-kit for Kanban (per existing decision memory)

### Backend Structure
- FastAPI with SQLAlchemy 2.0 ORM
- PostgreSQL database
- Pydantic v2 schemas for all entities
- Routers: projects, suppliers, invoices, analytics, unresolved_transactions, etc.

### Key Decision Memory (MEM092, MEM093)
- Frontend proxies to FastAPI, not direct Prisma access
- @dnd-kit for Kanban drag-and-drop

## Open Questions
- Scope of RBAC requirements for S04
- Production deployment considerations
