---
phase: M004
phase_name: "Bank Integration + Financials"
project: "ZakupPro"
generated: "2026-06-03T00:00:00.000Z"
counts:
  decisions: 6
  lessons: 3
  patterns: 7
  surprises: 2
missing_artifacts: []
---

# M004 LEARNINGS

## Decisions

- **Chose LargeBinary for raw_file in BankStatement to store 1C ClientBank files**
  - **Rationale:** Keep original data available for re-parsing and audit purposes
  - **Source:** S01-SUMMARY.md/Technical Decisions

- **Chose Numeric(3,2) for confidence_score to store 0.00-1.00 range**
  - **Rationale:** Precision matches matching confidence score range for efficient storage
  - **Source:** S01-SUMMARY.md/Technical Decisions

- **Chose JSON for matching_context for flexible algorithm metadata**
  - **Rationale:** Allows storing various matching algorithm details without schema changes
  - **Source:** S01-SUMMARY.md/Technical Decisions

- **Chose tolerance calculated FROM invoice total (not transaction amount)**
  - **Rationale:** Handles partial payments and rounding differences correctly
  - **Source:** S04-SUMMARY.md/Key Decisions

- **Chose confidence score linear interpolation (0.85 at boundary, 1.00 at exact match)**
  - **Rationale:** Clear confidence scaling for matching algorithm with predictable boundaries
  - **Source:** S04-SUMMARY.md/Key Decisions

- **Chose unified TransactionMatchingAudit for auto and manual matches**
  - **Rationale:** Single audit trail - manual matches use unresolved_transaction_id, auto matches use bank_transaction_id
  - **Source:** S05-SUMMARY.md/Key Decisions

## Lessons

- **Circular import between schemas.py and routers**
  - **What Happened:** schemas.py imported router modules, routers imported schemas.py
  - **Root Cause:** Direct imports creating dependency cycle
  - **Fix:** Dynamic schema loading via importlib.util in schemas/__init__.py
  - **Source:** S05-SUMMARY.md/Key Decisions

- **SQLAlchemy Session.refresh_all() doesn't exist**
  - **What Happened:** Attempted to call Session.refresh_all() in integration tests
  - **Root Cause:** API doesn't exist - SQLAlchemy uses individual refresh() calls
  - **Fix:** Used individual session.refresh(obj) calls for each object
  - **Source:** S05-SUMMARY.md/Key Decisions

- **Field variations in 1C ClientBank format (ПолучательИНН vs Получатель1)**
  - **What Happened:** Tinkoff uses ПолучательИНН, Ozon uses Получатель1 for supplier INN
  - **Root Cause:** Bank-specific format variations within 1C ClientBank standard
  - **Fix:** Parser handles both field variants for INN extraction
  - **Source:** S02-SUMMARY.md/Key Features

## Patterns

- **Bank statement processing: status transition Обрабатывается → Готов**
  - **Where:** parse_bank_statement Celery task
  - **Source:** S03-SUMMARY.md/patterns_established

- **FailedTask DLQ pattern for inspecting failed messages**
  - **Where:** Celery task error handling
  - **Source:** S03-SUMMARY.md/patterns_established

- **Multi-tier matching algorithm with confidence scoring**
  - **Where:** PaymentMatcher service
  - **Source:** S04-SUMMARY.md/patterns_established

- **INN extraction from Russian requisites text with regex**
  - **Where:** supplier_inn_extractor.py
  - **Source:** S04-SUMMARY.md/patterns_established

- **Unified audit trail pattern: TransactionMatchingAudit tracks both auto and manual matches**
  - **Where:** Payment creation (auto) and manual reconciliation (manual)
  - **Source:** S05-SUMMARY.md/patterns_established

- **Database dialect detection for SQLite vs PostgreSQL compatibility**
  - **Where:** Analytics payment-dynamics date truncation
  - **Source:** S06-SUMMARY.md/key_decisions

- **Integration test pattern: direct model operations for faster testing**
  - **Where:** S06 integration tests avoid API calls for performance
  - **Source:** S06-SUMMARY.md/patterns_established

## Surprises

- **1C ClientBank format varies between banks (Tinkoff vs Ozon field naming)**
  - **What:** Expected standard format, discovered ПолучательИНН vs Получатель1 variations
  - **Impact:** Parser needed flexible field handling for INN extraction
  - **Source:** S02-SUMMARY.md/Key Features

- **python-multipart dependency required for FastAPI file upload**
  - **What:** Manual upload endpoint failed without explicit dependency
  - **Impact:** Added python-multipart to requirements for upload support
  - **Source:** S06-SUMMARY.md/Key Decisions
