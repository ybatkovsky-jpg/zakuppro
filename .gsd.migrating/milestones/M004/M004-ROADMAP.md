# M004: Bank Integration + Financials

**Vision:** Automatic bank statement ingestion and payment reconciliation with manual fallback for unmatched transactions. The system processes 1C ClientBank statements from Tinkoff and Ozon Bank via email, auto-matches payments to invoices by INN and amount, and provides full accounting UI for resolving unmatched transactions.

## Success Criteria

- Email Worker detects bank statements and routes to new exchange
- 1C ClientBank .txt parser extracts transactions from Tinkoff/Ozon formats
- Auto-matching links payments to invoices by INN + amount ±5% + date range
- UnresolvedTransaction API supports filters, search, bulk operations, and audit log
- Analytics endpoints provide dashboard data (paid/unpaid, dynamics)
- Excel export endpoint for transactions
- Manual bank statement upload endpoint as fallback
- Telegram alerts for parse errors and missing statements

## Slices

- [x] **S01: S01** `risk:low` `depends:[]`
  > After this: Alembic migration creates BankStatement, BankTransaction, TransactionMatchingAudit tables with relationships. Test fixtures verify schema constraints and cascade behavior.

- [x] **S02: S02** `risk:high` `depends:[]`
  > After this: Parser processes Tinkoff and Ozon .txt files, extracts СекцияДокумент transactions. Unit tests verify parsing of real bank statements with Russian content and merged lines.

- [x] **S03: S03** `risk:medium` `depends:[]`
  > After this: Email Worker detects .txt attachments, routes to bank.statement exchange. parse_bank_statement Celery task processes statement and persists to DB. Integration test verifies end-to-end flow.

- [x] **S04: S04** `risk:high` `depends:[]`
  > After this: Auto-matcher links BankTransactions to Invoices by supplier INN + amount ±5% + date range. Unmatched transactions go to UnresolvedTransaction. Unit tests verify matching logic.

- [x] **S05: S05** `risk:medium` `depends:[]`
  > After this: API endpoints support unresolved transaction CRUD, bulk manual matching, and audit history. Integration test verifies full workflow from unmatched to matched state.

- [ ] **S06: S06** `risk:low` `depends:[]`
  > After this: Analytics endpoints return dashboard data (paid/unpaid counts, payment dynamics). Excel export generates .xlsx file. Manual upload endpoint processes uploaded .txt statements. Integration test verifies full flow.

## Boundary Map

Not provided.
