---
verdict: needs-attention
remediation_round: 0
---

# Milestone Validation: M007

## Success Criteria Checklist
## Milestone Success Criteria

| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| Все 7 сервисов имеют health endpoints и graceful shutdown | S01: GET /health returns per-service status for db, rabbitmq, celery_worker, email_worker, telegram_bot. Heartbeat-based checks via shared Docker volume. stop_grace_period configured (60s/30s/15s). SIGTERM handlers in telegram-bot and Celery. 13 health tests pass. | PASS |
| External calls обёрнуты в retry с exponential backoff + jitter | S02: retry_sync/retry_async decorators wired into 6 Telegram + 2 email notification functions. 61 tests pass. Pre-existing retry in llm_provider.py, ai_agent.py, tasks.py, imap_client.py was already in place and intentionally preserved. Pure stdlib implementation instead of tenacity (functionally equivalent, no dependency added). | PASS |
| Web UI разграничивает доступ по ролям (Owner/Manager/Склад) | S03: 125 RBAC integration tests pass. AuthProvider with useAuth() hook. Sidebar: warehouse=2 items, manager=8 items (no admin/settings), owner=11 views. Component-level action gating across 6 components. Backend require_role() on 6 routers. | PASS |
| DLQ админка позволяет просматривать и перезапускать failed tasks | S04: 3 API endpoints (list/detail/retry), 23 tests pass. Frontend FailedTasks component with paginated table, detail Sheet, retry AlertDialog. Admin sidebar section gated to owner. Retry deserializes context and calls apply_async(). | PASS |

## Per-Slice Acceptance Criteria

### S01 — Health Checks & Graceful Shutdown
| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| GET /health returns 200 with per-service status | 13 tests cover all-ok (200) and degraded (503) paths. S01-UAT TC1 confirms. | PASS |
| When SMTP unreachable: /health returns 503 | 3 degradation paths tested (email_worker, telegram_bot, db, rabbitmq). S01-UAT TC2 confirms. | PASS |
| docker-compose stop triggers graceful shutdown | SIGTERM handler, Celery worker_shutdown logs active task count. S01-UAT TC4 confirms. | PASS |

### S02 — Retry with Exponential Backoff
| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| Retry with exponential backoff + jitter on external calls | retry_sync/retry_async with base_delay * 2^attempt + random.uniform(0,1). 61 tests pass covering retry-then-succeed, exhaustion, backoff timing, jitter, non-retryable skip. | PASS |
| Permanent failure after max retries lands in FailedTask table | Returns False on exhaustion. Existing DLQ pattern handles FailedTask insertion. | PASS |
| No manual try/except retry loops remain in the codebase | 4 pre-existing manual loops (llm_provider.py, ai_agent.py, tasks.py, imap_client.py) intentionally preserved since they already had retry with different patterns (LLM_MAX_RETRIES, Celery autoretry, IMAP retry). S02 closed the email and Telegram gaps which had NO retry before. | NEEDS-ATTENTION — documented deviation from original CONTEXT.md plan to replace all loops with tenacity |

### S03 — Role-Based Access in Web UI
| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| Warehouse sees: Dashboard, Stock | visibleMainNavItems filtered. S03-UAT TC4 confirms. | PASS |
| Manager sees: main views (not admin/settings) | 8 items, no Settings, no Admin. S03-UAT TC3 confirms. | PASS |
| Owner sees all items | 11 views including settings + admin. S03-UAT TC2 confirms. | PASS |
| Backend returns 403 for unauthorized access | 125 RBAC tests, structured 403 with PERMISSION_DENIED. S03-UAT TC7 confirms. | PASS |

### S04 — DLQ Admin UI
| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| /admin/failed-tasks renders table | shadcn Table: ID, Task Name, Error Type, Created At, Actions. S04-UAT step 2. | PASS |
| Detail view with full context JSON | Sheet drawer with metadata, error message in pre block, pretty-printed context. S04-UAT step 3. | PASS |
| Retry button re-dispatches task | POST /{id}/retry calls apply_async(). 23 tests pass. S04-UAT step 4. | PASS |
| Successful retry marks record | Record is deleted on success (not marked as "retried"). S04-UAT confirms row removal from table. | NEEDS-ATTENTION — minor: deletes instead of marking retried |
| Failed retry shows error toast | Error state with AlertTriangle + Retry button. AlertDialog confirmation dialog. | PASS |

## Slice Delivery Audit
## Slice Delivery Audit

All 4 slices are complete with SUMMARY.md and verification_result=passed:

| Slice | Title | Tasks | Status | SUMMARY.md | ASSESSMENT | Known Limitations |
|-------|-------|-------|--------|------------|------------|-------------------|
| S01 | Health Checks & Graceful Shutdown | 3/3 | complete | Yes | passed | Cross-container heartbeat is unidirectional; multi-replica not tested |
| S02 | Retry with Exponential Backoff | 3/3 | complete | Yes | passed | None documented |
| S03 | Role-Based Access in Web UI | 4/4 | complete | Yes | passed | None documented |
| S04 | DLQ Admin UI | 4/4 | complete | Yes | passed | None documented |

All slices passed their verification gates. No outstanding follow-ups that block milestone completion.

## Cross-Slice Integration
## Cross-Slice Integration

### Slice Dependency Map
All four slices declared `depends: []` — no formal dependencies. However, S04 functionally depends on S03's RBAC infrastructure.

### Traced Boundary: S03 → S04 (RBAC Integration)

| Boundary | Producer (S03) | Consumer (S04) | Status |
|----------|---------------|----------------|--------|
| Backend RBAC | `require_role([Role.OWNER])` dependency in backend/rbac.py | `Depends(require_role([Role.OWNER]))` on all 3 /api/admin/failed-tasks endpoints | HONORED |
| Frontend Auth | `AuthProvider`/`useAuth()` in auth-provider.tsx | `const { role } = useAuth()` in failed-tasks.tsx gates retry button | HONORED |
| Sidebar Navigation | Role-filtered `visibleMainNavItems` + `showSettings` pattern | "Администрирование" group gated by `role === 'owner'` | HONORED |
| View Routing | `roleViewAccess` map includes 'failed-tasks' as owner-only | S04 relies on pre-existing route guard; adds sidebar entry | HONORED |

### Traced End-to-End Flow (Owner → DLQ Admin → Retry)
1. **S03**: LoginPage → AuthProvider stores token, fetches /api/auth/users/me → user.role = 'owner'
2. **S03**: AppSidebar reads role → renders all nav items + Администрирование section
3. **S04**: User clicks AlertTriangle → navigates to 'failed-tasks' view
4. **S03**: page.tsx checks roleViewAccess → owner authorized
5. **S04**: failedTasksApi.list() → GET /api/admin/failed-tasks → S03 RBAC guard passes
6. **S04**: Click retry → POST /{id}/retry → apply_async dispatches → row deleted

All six steps verified across S03 and S04 layers.

### Standalone Slices
- **S01** (Health): No consumer in S02/S03/S04. Heartbeat/endpoint is independently verifiable.
- **S02** (Retry): Used by email_notifier.py and telegram_notifier.py. No dependency from S03/S04.

### Verdict: PASS — all cross-slice boundaries honored

## Requirement Coverage
## M007 Requirements Coverage

All 5 requirements touched by M007 are technically covered:

| Requirement | Status | Evidence | 
|-------------|--------|----------|
| **R015** — Graceful shutdown for all services | COVERED | S01: telegram-bot SIGTERM/SIGINT handler with shutdown flag; Celery worker_shutdown signal logging active task count; docker-compose.yml stop_grace_period (60s/30s/15s); Docker healthchecks via heartbeat freshness. Verified by 33 email-worker + 13 health + 2 shutdown tests. |
| **R016** — Health check endpoints for all services | COVERED | S01: /health returns status for all 5 service groups (db, rabbitmq, celery_worker, email_worker, telegram_bot). Heartbeat freshness checks (120s/90s). Atomic heartbeat writes. 13 health tests pass. |
| **R017** — DLQ UI/admin for failed tasks | COVERED | S04: 3 backend endpoints (list/detail/retry) at /api/admin/failed-tasks, 23 tests. Frontend FailedTasks component with paginated table, Sheet drawer, AlertDialog retry. Sidebar admin section (AlertTriangle) gated to owner. |
| **R018** — Role-based access in Web UI | COVERED | S03: 6 backend routers protected with require_role(), 125 RBAC tests. AuthProvider React context with useAuth(). LoginPage. Sidebar/view/component-level role gating. |
| **R019** — Retry with exponential backoff | COVERED | S02: retry_utils.py with sync/async decorators. 6 Telegram + 2 email functions wrapped. 61 tests pass. LLM and Celery retry pre-existed; this closes notification pathway gaps. |

R015 and R016 remain marked "active" in REQUIREMENTS.md awaiting milestone-level validation promotion. Technical delivery is complete.

### Verdict: PASS — all 5 requirements covered

## Verification Class Compliance
## Verification Classes

| Class | Planned Check | Evidence | Verdict |
|-------|---------------|----------|---------|
| **Contract** | All 4 slice-level UATs pass | S01-UAT, S02-UAT, S03-UAT, S04-UAT exist. All slices report verification_result: passed. | PASS |
| **Contract** | Health endpoint returns correct status per service | S01: 13 API-level tests with mocked dependencies cover all-ok and 3 degradation paths. | PASS |
| **Contract** | Sidebar renders only authorized items per role | S03: 125 RBAC tests. AuthProvider + sidebar filter + view guard + component gating. | PASS |
| **Contract** | FailedTask retry re-dispatches correct Celery task | S04: Retry endpoint deserializes context, resolves task name, calls apply_async(). 23 tests pass. | PASS |
| **Contract** | All external calls use retry decorators | S02 used pure stdlib (time/asyncio/random/functools), not tenacity as planned. 4 pre-existing manual retry loops in LLM/Celery/IMAP code intentionally preserved (they already had retry). Functionally equivalent. | NEEDS-ATTENTION |
| **Integration** | docker-compose up → health endpoint reports live status | S01-UAT TC1: curl /health returns 200 with 5 services ok. | PASS |
| **Integration** | Simulated failure → retry → success or DLQ | S02 tested SMTP/Telegram mocks with 61 tests. LLM retry pre-existed (LLM_MAX_RETRIES). | PASS |
| **Integration** | Admin clicks Retry → task re-runs via Celery | S04: POST /retry calls apply_async(). Backend verified via 23 tests. Frontend verified via tsc. | PASS |
| **Operational** | Graceful shutdown preserves in-flight tasks | S01-UAT TC4: SIGTERM handlers, Celery worker_shutdown signal, stop_grace_period configured. | PASS |
| **Operational** | Health endpoint degrades gracefully on dependency failure | S01-UAT TC2: Stale heartbeat returns 503. 3 degradation paths tested. | PASS |
| **Operational** | Failed task context survives restarts | S04 stores context JSON in FailedTask model. No restart survival test exists. S01 follow-ups note end-to-end stop/start verification not done. | NEEDS-ATTENTION |


## Verdict Rationale
All 4 M007 slices delivered their core functionality with passing tests (13+61+125+23=222 tests total). All 5 requirements (R015-R019) are technically covered. Cross-slice integration between S03 (RBAC) and S04 (DLQ Admin) is fully honored at 4 integration points. Three minor issues flagged by acceptance criteria review: (1) S02 used pure stdlib instead of tenacity and left 4 pre-existing manual retry loops — these loops already had retry and were intentionally preserved, so this is a scope refinement, not a gap; (2) S04 deletes FailedTask records on successful retry rather than marking them — this is a UX choice that matches the UAT; (3) Failed task context survival across Docker restarts is unproven — this is a documented follow-up in S01. No blocking issues. Verdict: needs-attention.
