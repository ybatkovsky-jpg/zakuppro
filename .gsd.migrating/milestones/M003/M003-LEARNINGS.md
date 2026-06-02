---
phase: 3
phase_name: execution
project: zakuppro
generated: 2026-06-02T03:30:00Z
counts:
  decisions: 8
  lessons: 6
  patterns: 5
  surprises: 2
missing_artifacts: []
---

# M003 Learnings

## Decisions

### D001 — LLM Provider Fallback Strategy
**Choice:** Provider-agnostic wrapper with configuration-driven primary/secondary providers and automatic fallback on rate limit/timeout
**Rationale:** Different providers have different pricing (GPT-4o-mini cheap, Gemini 2.5 Flash cheaper, Claude Sonnet premium). Fallback ensures continuity when primary API fails. Configuration allows switching without code changes. Exponential backoff (1s, 2s, 4s) handles transient errors. Non-transient errors (validation) go directly to DLQ.
**Source:** S01-SUMMARY.md/T02: LLM Provider Wrapper

### D002 — Invoice File Storage Strategy
**Choice:** Store original invoice files as BLOB in PostgreSQL BYTEA column (Invoice.raw_file)
**Rationale:** Audit trail requires original files for legal protection and re-parsing when extraction logic changes. Database storage simplifies backup/restore and keeps transactional consistency with invoice metadata. PostgreSQL BYTEA handles PDF/Excel files efficiently.
**Source:** S01-SUMMARY.md/T01: Database Schema Extensions

### D003 — InvoiceItem Schema Design
**Choice:** Nullable project_item_id with cascade='all, delete-orphan' relationship
**Rationale:** Supports unmapped line items (items in invoice but not in BOM). Cascade delete ensures InvoiceItems are removed when Invoice is deleted, maintaining referential integrity.
**Source:** S01-SUMMARY.md/T01: Database Schema Extensions

### D004 — IMAP Ingestion Strategy
**Choice:** Auto-poll separate email mailbox (invoices@company.com) with Celery task publishing for attachment processing
**Rationale:** Suppliers send invoices in response to purchase requests. 1 email = 1 supplier = 1 invoice pattern simplifies processing. Auto-poll balances real-time processing with load control. Celery integration enables asynchronous processing pipeline.
**Source:** S02-SUMMARY.md/What Happened

### D005 — IMAP Client Implementation
**Choice:** Use imaplib standard library instead of external IMAP packages
**Rationale:** Standard library sufficient for IMAP operations, reduces dependency count. AttachmentExtractor separated for testability. File-based Message-ID persistence handles duplicate detection across restarts.
**Source:** S02-SUMMARY.md/key_decisions

### D006 — Invoice Verification Matching Strategy
**Choice:** Multi-tier matching: exact SKU match → OK, SKU differs + RapidFuzz name similarity >85% → clarification, quantity differs → partial flag
**Rationale:** Strict matching fails on legitimate name variations. Fuzzy matching reduces false positives while catching discrepancies. Clarification flow handles ambiguous cases. Similarity threshold (85%) tunable based on production data.
**Source:** S04-SUMMARY.md/What Happened

### D007 — Email Notification Strategy for Clarifications
**Choice:** SMTP outbound for supplier clarifications, Telegram for owner notifications
**Rationale:** Suppliers already use email for invoices. Email clarifications fit existing workflow. Telegram provides real-time alerts for owner. Separation of concerns: supplier comms via email, internal comms via Telegram.
**Source:** S05-SUMMARY.md/What Happened

### D008 — Non-Blocking Notification Pattern
**Choice:** Notification failures log errors and return False without blocking invoice processing
**Rationale:** Failed notifications should not prevent invoice from being recorded. Owner gets alert via other channels (DLQ, manual review). MEM037 pattern ensures pipeline continues despite notification service issues.
**Source:** S05-SUMMARY.md/key_decisions

## Lessons

### L001 — DetachedInstanceError Prevention
**What Happened:** SQLAlchemy DetachedInstanceError occurred when accessing model attributes after session closure in S04 tests
**Root Cause:** Object accessed outside its session lifecycle
**Fix:** Capture object IDs before session closure, query fresh objects for assertions
**Source:** S04-SUMMARY.md/Deviations

### L002 — Test Infrastructure for Celery Tasks
**What Happened:** Testing Celery tasks directly required bypassing @app.task wrapper
**Root Cause:** Celery decorator obscures business logic with async/serialization concerns
**Fix:** Created call_parse_invoice_task() and call_verify_invoice_task() helper functions to test core logic directly
**Source:** S03-SUMMARY.md/Technical Decisions, S04-SUMMARY.md/key_decisions

### L003 — SQLAlchemy Base vs TestBase
**What Happened:** Using separate TestBase caused table creation issues in S03 tests
**Root Cause:** TestBase didn't inherit proper metadata from models
**Fix:** Use actual SQLAlchemy Base from models for proper table creation in integration tests
**Source:** S03-SUMMARY.md/Technical Decisions

### L004 — Mock Strategy for External Dependencies
**What Happened:** Module-level mocking required for reliable LLM/pdfplumber/pandas tests
**Root Cause:** Real API calls and file I/O cause flaky tests
**Fix:** Mock at module level (backend.services.invoice_parser, backend.database) before importing test module
**Source:** S03-SUMMARY.md/Technical Decisions

### L005 — datetime.utcnow() Deprecation
**What Happened:** DeprecationWarning for datetime.utcnow() in invoice_verifier.py line 165
**Root Cause:** Python 3.12+ deprecates naive UTC datetime
**Fix:** Use datetime.now(datetime.UTC) for timezone-aware UTC datetimes (follow-up)
**Source:** S04-SUMMARY.md/Follow-ups

### L006 — Non-Retryable Errors Go Directly to DLQ
**What Happened:** Validation errors raise ValueError directly to Celery DLQ, no FailedTask record
**Root Cause:** Retrying validation errors won't produce different result
**Fix:** Test validation errors raise ValueError, Celery handles DLQ automatically
**Source:** S06-SUMMARY.md/key_decisions

## Patterns

### P001 — LLM Provider Wrapper with Fallback
**Where:** S01 llm_provider.py
**Pattern:** BaseLLMProvider abstract interface → concrete providers → LLMProvider wrapper with primary/secondary selection and automatic fallback on transient errors
**Reusability:** Apply to any multi-provider LLM integration (parsing, verification, chat)
**Source:** S01-SUMMARY.md/key_decisions

### P002 — IMAP Polling with Duplicate Detection
**Where:** S02 IMAPClient, EmailWorker
**Pattern:** Poll interval (60s) → fetch unseen emails → extract attachments → check Message-ID persistence → publish task or skip duplicate
**Reusability:** Use for any email-based ingest pipeline (orders, confirmations, documents)
**Source:** S02-SUMMARY.md/patterns_established

### P003 — Graceful Shutdown via Signal Handlers
**Where:** S02 EmailWorker
**Pattern:** Register SIGTERM/SIGINT handlers → set shutdown flag → allow current iteration to complete → clean exit
**Reusability:** Apply to all long-running worker processes for container orchestration
**Source:** S02-SUMMARY.md/patterns_established

### P004 — Notification Functions Pattern
**Where:** S05 telegram_notifier.py, email_notifier.py
**Pattern:** _get_bot()/_check_smtp_config() → return bool on success/failure → log errors with context → non-blocking
**Reusability:** Follow for all notification channels (SMS, Slack, webhooks)
**Source:** S05-SUMMARY.md/patterns_established

### P005 — E2E Test Chaining Pattern
**Where:** S06 test_s06_e2e_integration.py
**Pattern:** db_session fixture → call_parse_invoice_task() → call_verify_invoice_task() → mock dispatch_invoice_notifications → assert Invoice.status, verification_result
**Reusability:** Use for end-to-end testing of any multi-stage Celery pipeline
**Source:** S06-SUMMARY.md/patterns_established

## Surprises

### U001 — 13 E2E Tests Achieve 95% Coverage
**Unexpected:** Test coverage for S06 E2E test suite reached 95% with only 23 missed lines
**Context:** Expected E2E tests to have lower coverage due to complexity. Mock strategy and helper functions contributed to high coverage.
**Source:** S06-SUMMARY.md/Verification Results

### U002 — Validation Error Propagation to Celery DLQ
**Unexpected:** Validation errors raise ValueError directly to Celery DLQ without FailedTask record
**Context:** Expected FailedTask record for all errors. Celery's built-in retry mechanism handles transient errors; validation errors are non-retryable.
**Source:** S06-SUMMARY.md/key_decisions
