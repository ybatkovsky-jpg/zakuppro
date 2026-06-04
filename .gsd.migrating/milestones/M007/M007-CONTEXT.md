# M007: Production Hardening

**Gathered:** 2026-06-04
**Status:** Ready for planning

## Project Description

Production hardening — closing all deferred reliability, observability, security, and administration gaps before going to production. Four independent workstreams: health checks, unified retry, role-based UI, and DLQ admin panel.

## Why This Milestone

M001–M006 delivered functional completeness: BOM upload, invoice parsing, bank statements, stock reservations, Kanban UI. But the system has no consistent retry strategy across external calls, health endpoints are minimal, the sidebar shows all items regardless of role, and failed tasks have no admin UI. These are the gaps between "works in dev" and "runs in production."

Last milestone before real эксплуатация.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Call GET /health on the API and see live connectivity status of SMTP, Telegram, DB, Celery, and email-worker heartbeat
- See sidebar filtered by their role — Владелец sees everything, Менеджер sees their projects, Склад sees only stock screens
- Browse /admin/failed-tasks, see full error details and task context, and retry a failed task with one click
- Trust that transient API failures (OpenAI rate limits, SMTP timeouts, Telegram errors) auto-recover with consistent exponential backoff

### Entry point / environment

- Entry point: Browser at http://localhost:3000 (Web UI), GET /health (API), docker-compose (services)
- Environment: local dev with Docker Compose (7 services)
- Live dependencies involved: Telegram, SMTP server, OpenAI API, PostgreSQL, RabbitMQ, Celery workers

## Completion Class

- Contract complete means: All 4 slice-level UATs pass; health endpoint returns correct status per service; sidebar renders only authorized items per role; FailedTask retry re-dispatches the correct Celery task; all external calls use tenacity decorators
- Integration complete means: docker-compose up → health endpoint reports live status; simulated OpenAI failure → tenacity retries → task succeeds or lands in DLQ; admin clicks Retry → task re-runs via Celery
- Operational complete means: Graceful shutdown preserves in-flight tasks; health endpoint degrades gracefully when a dependency is down; failed task context survives restarts

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Health endpoint returns live status of all 4 dependencies (SMTP, Telegram, DB, Celery) plus email-worker heartbeat via shared volume
- A deliberately failed Celery task appears in the FailedTask table, and clicking Retry re-dispatches it with original context via task name lookup
- Sidebar hides unauthorized menu items per role — Склад user never sees project management screens

## Architectural Decisions

### S02: Retry Strategy — Tenacity

**Decision:** Use the `tenacity` library for all retry logic, replacing 4 existing ad-hoc manual retry loops (llm_provider.py, ai_agent.py, tasks.py, imap_client.py).

**Rationale:** Tenacity is the Python standard for retry decorators. It provides consistent exponential backoff, jitter, retry-on-exception predicates, and before/after logging hooks. One dependency replaces 4 inconsistent implementations.

**Alternatives Considered:**
- Manual shared utility (`retry_utils.py`) — Simpler, no new dependency, but less flexible. Retry logic still lives in application code. Tenacity is battle-tested and used in Celery itself.

### S04: FailedTask Retry — Full Celery Re-dispatch

**Decision:** When admin clicks Retry on a FailedTask, the system deserializes the saved `context` JSON, resolves the Celery task by name (string → `@app.task` signature), and calls `apply_async()` with original args/kwargs. The FailedTask record is marked as retried.

**Rationale:** Full automation. No manual re-upload or re-trigger needed. The retry endpoint must have access to the Celery app instance and must correctly parse per-task-type context schemas (different for BOM parsing vs invoice parsing vs bank statement).

**Alternatives Considered:**
- Read-only + Dismiss — Admin views error details but re-runs manually. Simpler to implement but defeats the purpose of a DLQ admin UI. Owner would still need to re-upload files.

### S03: Role-Based Sidebar — Hide, Not Gray Out

**Decision:** Unauthorized sidebar items are removed from the DOM entirely. Warehouse role sees only Dashboard + Склад. Manager sees everything except admin-only items.

**Rationale:** Cleaner UX. Grayed-out items with lock icons create confusion ("why can't I click this?"). Hiding removes cognitive load and follows the principle of least privilege in the UI.

**Alternatives Considered:**
- Gray out with lock icon — Shows the full menu structure but is visually cluttered and invites frustration.

## Error Handling Strategy

- **Retry (S02):** Tenacity decorators with exponential backoff + jitter for all external calls. Existing DLQ pattern preserved: after max retries, task lands in FailedTask table with full context.
- **Health (S01):** Fail-fast on critical dependencies (DB), graceful degradation on non-critical (SMTP, Telegram). Email-worker and telegram-bot are non-HTTP services — heartbeat via shared Docker volume.
- **FailedTask retry (S04):** If re-dispatch fails (task not found, invalid context), surface error in UI without side effects. Original FailedTask record preserved.
- **RBAC (S03):** Backend enforces authorization (401/403). Frontend filters are cosmetic convenience, not security — backend is the enforcement point.

## Risks and Unknowns

- S04 per-task-type context schema parsing — Each Celery task (parse_excel_bom, parse_invoice, parse_bank_statement) has different args/kwargs. The retry endpoint must handle the union. Risk of re-dispatching with incomplete or wrong arguments if context serialization is inconsistent.
- S01 shared volume heartbeat — Docker named volumes work well locally but need verification that the healthcheck_data volume is correctly mounted in both api and email-worker containers.
- S03 RBAC granularity — Current auth model may not have fine-grained role field. May need to add role column to User model or derive from existing ownership patterns.

## Existing Codebase / Prior Art

- `backend/app/services/llm_provider.py` — Existing manual retry loop. Will be replaced by tenacity in S02.
- `backend/app/tasks/ai_agent.py` — Another manual retry loop. Same replacement.
- `backend/app/tasks/tasks.py` — Celery task retry with `self.retry()`. Keep Celery's built-in retry; add tenacity for the external calls within tasks.
- `backend/app/services/imap_client.py` — IMAP polling retry. Replace with tenacity.
- `backend/app/models/failed_task.py` — FailedTask model with context JSON field. S04 reads and re-dispatches from this.
- `frontend/src/app/layout.tsx` — Sidebar component. S03 modifies role-based visibility.
- `backend/app/routers/health.py` — Existing basic health endpoint. S01 extends with multi-service checks.
- `backend/app/services/telegram_notifier.py` — Returns False on failure (non-blocking). S02 adds tenacity for the outbound HTTP call.

## Relevant Requirements

- R015 — Graceful shutdown for all services. Advances: S01 (health + shutdown hooks).
- R016 — Health endpoints for all services. Advances: S01 (multi-service health check).
- R017 — DLQ admin UI with retry. Advances: S04 (FailedTask table + retry button).
- R018 — Role-based access in Web UI. Advances: S03 (sidebar filtering by role).
- R019 — Retry with exponential backoff for external calls. Advances: S02 (tenacity).

## Scope

### In Scope

- Unified retry decorators via tenacity for all external calls (LLM APIs, SMTP, Telegram, IMAP)
- Health endpoint with live connectivity checks (SMTP, Telegram, DB, Celery, email-worker heartbeat)
- Graceful shutdown hooks for Celery workers and FastAPI
- Role-based sidebar filtering in Next.js frontend (Owner/Manager/Склад)
- FailedTask admin page with table, detail view, and Retry button (full Celery re-dispatch)
- Backend RBAC enforcement on relevant endpoints

### Out of Scope / Non-Goals

- Full audit logging system (already covered by TransactionMatchingAudit pattern)
- Real-time monitoring dashboard (Grafana/Prometheus)
- Rate limiting on API endpoints
- Multi-tenancy (single company, single deployment)
- Email-worker and telegram-bot HTTP health endpoints (non-HTTP services, heartbeat via shared volume instead)
- CI/CD pipeline hardening

## Technical Constraints

- All existing Celery tasks must continue to work after tenacity migration
- FailedTask context field must be backwards-compatible — existing records must remain readable
- Sidebar filtering is cosmetic (frontend only) — backend RBAC is the enforcement layer
- Docker Compose remains the deployment target (no Kubernetes)
- Python 3.12+, FastAPI 0.100+, Next.js 14+

## Integration Points

- Celery app instance — S04 retry endpoint needs `current_app` to resolve task names and call `apply_async()`
- Docker named volume `healthcheck_data` — S01 shared heartbeat between api and email-worker containers
- Frontend auth context — S03 reads user role from auth state (NextAuth.js or custom context)
- RabbitMQ DLQ — Existing DLQ configuration from M002. S04 reads from FailedTask table, not directly from RabbitMQ.

## Testing Requirements

- **S01:** Unit tests for each health check function (SMTP connectivity, Telegram ping, DB query, Celery ping). Integration test for /health endpoint returning correct status codes. Docker Compose integration test verifying shared volume heartbeat.
- **S02:** Unit tests for each tenacity-decorated function (verify retry count, backoff timing). Mock tests for transient failure → retry → success and permanent failure → DLQ. Verify all 4 existing retry loops are replaced.
- **S03:** Frontend component tests for sidebar rendering per role. Backend integration tests for 403 on unauthorized endpoints. E2E: login as Склад → sidebar shows only Dashboard + Склад.
- **S04:** Backend tests for retry endpoint: happy path (task found + dispatched), error path (task not found, invalid context). Frontend tests for FailedTask table rendering, Retry button click flow. End-to-end: create failed task → view in UI → retry → task re-executes.

## Acceptance Criteria

### S01: Health Checks & Graceful Shutdown
- GET /health returns 200 with per-service status (DB, Celery, SMTP, Telegram, email-worker)
- When SMTP is unreachable: /health returns 503 with smtp: degraded
- docker-compose stop triggers graceful shutdown, in-flight Celery tasks complete or persist to DLQ

### S02: Retry with Exponential Backoff
- Simulated OpenAI 429 triggers 2 retries with growing delay, then succeeds
- Permanent failure after max retries lands in FailedTask table (existing DLQ pattern)
- No manual try/except retry loops remain in the codebase

### S03: Role-Based Access in Web UI
- Склад user sees: Dashboard, Склад
- Менеджер sees: Dashboard, Projects, Specifications, Stock (not admin pages)
- Владелец sees all items
- Backend returns 403 when Склад user accesses project endpoints

### S04: DLQ Admin UI
- /admin/failed-tasks renders table with task_name, error_message, created_at
- Click on row expands detail view with full context JSON
- Retry button calls POST /api/admin/failed-tasks/{id}/retry
- Successful retry marks record as retried, failed retry shows error toast

## Open Questions

- None. All key architectural decisions resolved during discuss-milestone interview.
