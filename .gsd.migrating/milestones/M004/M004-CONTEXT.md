# M004: Bank Integration + Financials

**Gathered:** 2026-06-02
**Status:** Ready for planning

## Project Description

Build a Bank Worker service that automatically imports bank statements from email and matches payments to invoices. The system polls an IMAP mailbox for bank statement emails in 1С ClientBank format (standardized across Russian banks), parses transactions, matches payments to existing invoices using Supplier.INN + amount + date proximity, and creates Payment records linked to Invoices. Payments that cannot be auto-matched are preserved as UnresolvedTransaction records for manual reconciliation. The service emits RabbitMQ events and sends Telegram alerts for unresolved transactions.

## Why This Milestone

After M003 completes invoice verification (Invoice.status moves to "В работе", "Оплачено", etc.), the financial loop needs closure. When a supplier is paid, that payment should be automatically linked to the corresponding invoice. Without this automation, accountants must manually match payments, which is error-prone and time-consuming. This milestone closes the loop: bank statement → payment detection → invoice linkage → financial visibility.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Connect an IMAP mailbox to automatically receive bank statements from their bank
- See payments automatically matched to invoices in the system
- View unresolved transactions that require manual reconciliation
- Receive Telegram notifications when payments cannot be auto-matched

### Entry point / environment

- Entry point: Bank Worker background service (FastAPI app with APScheduler/CELERY-like polling)
- Environment: Production server with IMAP access, RabbitMQ, PostgreSQL, Telegram Bot
- Live dependencies involved: IMAP mailbox, RabbitMQ (bank.statement exchange), Telegram Bot, PostgreSQL

## Completion Class

- Contract complete means: Bank Worker can download 1С ClientBank files from IMAP, parse transactions, match payments to invoices by Supplier.INN + amount, create Payment records, and create UnresolvedTransaction for unmatched payments. Unit tests cover parsing and matching logic; integration tests cover IMAP download and database persistence.
- Integration complete means: End-to-end flow works: email arrives → Bank Worker processes it → Payment/UnresolvedTransaction created → RabbitMQ event emitted → Telegram alert sent (if unresolved). Invoice.status updates to "Оплачен" when fully matched.
- Operational complete means: Service runs continuously, handles IMAP reconnection, retries failed processing, persists failed transactions for recovery, and exposes health metrics.

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- A real 1С ClientBank file from a Russian bank can be emailed to the test mailbox, processed by Bank Worker, and results in correct Payment records linked to existing Invoices.
- When payment cannot be matched (unknown Supplier.INN or amount mismatch), it creates UnresolvedTransaction and sends Telegram alert.
- RabbitMQ `bank.statement` exchange emits events consumed by downstream services.
- Service recovers from IMAP disconnection and processing errors without data loss.

## Architectural Decisions

### Email Polling Strategy

**Decision:** Use IMAP IDLE or polling with APScheduler to detect new bank statement emails. Download attachments, parse 1С ClientBank format, mark emails as processed.

**Rationale:** 1С ClientBank is standardized across Russian banks — no format variation between banks. IMAP is universally supported by Russian banks for statement delivery.

**Alternatives Considered:**
- Bank API integration — Not chosen: Russian banks have inconsistent APIs; many only support email delivery.
- Webhook-based statement delivery — Not chosen: Most Russian banks don't support webhooks; email is the standard delivery method.

### Payment Matching Algorithm

**Decision:** Match payments to invoices using Supplier.INN (primary key) + amount (exact match or within tolerance) + date proximity (payment within reasonable window after invoice date). Multiple candidates create UnresolvedTransaction for manual review.

**Rationale:** INN uniquely identifies suppliers in Russia. Amount matching with tolerance handles minor differences (fees, rounding). Date proximity prevents matching ancient invoices.

**Alternatives Considered:**
- Invoice number matching — Not chosen: Bank statements often lack invoice numbers; INN+amount is more reliable.
- ML-based matching — Not chosen: Overkill for this scope; rule-based matching is sufficient and explainable.

### Unresolved Transaction Handling

**Decision:** Payments that cannot be auto-matched create UnresolvedTransaction records with Supplier.INN, amount, date, and raw transaction data. Accountants manually reconcile via UI (out of scope for M004).

**Rationale:** Some payments will always need manual review (new suppliers, partial payments, split payments). Persisting them with full context enables reconciliation.

**Alternatives Considered:**
- Auto-create new suppliers — Not chosen: Risk of duplicate suppliers; requires human verification.
- Discard unmatched — Not chosen: Every payment must be accounted for; losing data is unacceptable.

### Error Notification Strategy

**Decision:** Telegram alerts for unresolved transactions and processing failures. RabbitMQ events for all processed statements (matched and unmatched).

**Rationale:** Telegram provides immediate visibility for issues requiring human attention. RabbitMQ enables downstream consumers (reporting, analytics) to receive all payment events.

**Alternatives Considered:**
- Email alerts — Not chosen: Slower than Telegram; accountants may not monitor email constantly.
- Silent failure with logs only — Not chosen: Unresolved payments require immediate attention; passive logging is insufficient.

## Error Handling Strategy

- **IMAP connection failure:** Exponential backoff retry, log errors, alert after N consecutive failures. Persist last-seen UID to avoid reprocessing.
- **Parsing failure:** Save raw attachment to disk, log error, alert via Telegram. Mark email as processed to avoid infinite retry loop.
- **Database failure:** Retry with exponential backoff, queue failed operations for recovery.
- **RabbitMQ failure:** Retry publishing, persist events to dead-letter queue after max retries.
- **Matching ambiguity:** If multiple invoices match criteria, create UnresolvedTransaction for manual review.

## Risks and Unknowns

- **Email type detection false positives** — Bank statement emails might be misclassified as invoices or vice versa. Matters because wrong processing type skips payment detection or creates errors.
- **Auto-matching false positives** — Wrong invoice gets marked as paid. Matters because financial discrepancies could go unnoticed; requires audit trail.
- **IMAP mailbox security** — Credentials stored in environment variables. Matters because compromise exposes financial data; requires secure secret management.

## Existing Codebase / Prior Art

- `app/models/payment.py` — Payment ORM model with links to Invoice
- `app/models/unresolved_transaction.py` — UnresolvedTransaction model for manual reconciliation
- `app/models/supplier.py` — Supplier model with INN field (primary matching key)
- `app/models/invoice.py` — Invoice model with status field ("Оплачен")
- `app/workers/email_worker.py` — Reference for email polling pattern (used for invoices)
- `app/rabbitmq/` — Existing RabbitMQ infrastructure for event emission

## Relevant Requirements

- **R-FIN-001** — Automatic payment matching against invoices
- **R-FIN-002** — Bank statement import via email
- **R-FIN-003** — Unresolved transaction handling for manual reconciliation
- **R-AUDIT-001** — Audit trail for all financial transactions

## Scope

### In Scope

- IMAP email polling for bank statement emails
- 1С ClientBank format parsing
- Payment matching by Supplier.INN + amount + date proximity
- Payment record creation linked to Invoices
- UnresolvedTransaction creation for unmatched payments
- Invoice.status update to "Оплачен" when fully matched
- RabbitMQ `bank.statement` exchange event emission
- Telegram alerts for unresolved transactions and processing failures
- IMAP reconnection and error recovery
- Health endpoint and metrics exposure

### Out of Scope / Non-Goals

- Manual reconciliation UI for UnresolvedTransaction (future milestone)
- Bank API integrations (beyond email-based statement delivery)
- Partial payment handling (future milestone)
- Split payment handling (future milestone)
- Multi-currency support (future milestone)

## Technical Constraints

- Must support standard 1С ClientBank format (all Russian banks)
- IMAP mailbox must be accessible (SSL/TLS required)
- RabbitMQ must be available for event emission
- Telegram Bot token must be configured
- Service must run continuously (daemon/background worker)

## Integration Points

- **IMAP Mailbox** — Polling for bank statement emails with 1С ClientBank attachments
- **RabbitMQ** — `bank.statement` exchange for payment events (matched and unmatched)
- **Telegram Bot** — Error alerts for unresolved transactions and processing failures
- **PostgreSQL** — Payment, UnresolvedTransaction, Invoice, Supplier persistence
- **Supplier Service** — Supplier lookup by INN for matching

## Testing Requirements

- Unit tests for 1С ClientBank parsing logic
- Unit tests for payment matching algorithm (INN + amount + date)
- Integration tests for IMAP download and email marking
- Integration tests for database persistence (Payment, UnresolvedTransaction)
- Integration tests for RabbitMQ event emission
- End-to-end test with fixture 1С ClientBank file
- Coverage threshold: 80% for Bank Worker code

## Acceptance Criteria

- Bank Worker downloads and processes bank statement emails from IMAP
- 1С ClientBank files are parsed correctly across all standard fields
- Payments are matched to existing invoices by Supplier.INN + amount
- Matched payments create Payment records linked to Invoice
- Invoice.status updates to "Оплачен" when payment matches
- Unmatched payments create UnresolvedTransaction records
- Telegram alerts sent for unresolved transactions
- RabbitMQ emits `bank.statement.payment.matched` and `.unmatched` events
- Service recovers from IMAP disconnection without data loss
- Health endpoint returns service status

## Open Questions

None — all technical decisions are clear from requirements.
