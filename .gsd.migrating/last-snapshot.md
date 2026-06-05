# GSD context snapshot (2026-06-04T23:04:52.487Z)

## Active context
Active: M007 / S02 / T03 - Applied @retry_sync(TelegramError) to all 6 telegram_notifier.py functions, removed internal TelegramError catches, added 6 retry tests — 23/23 passing

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [0877f48f-45ea-48d9-83a5-75663ff474d1] bash exit:1 — Check embedded Python and pytest version
- [c88b8b74-790a-4a5b-8c3b-68164e8af1ac] bash exit:1 — Check python3 availability
- [4a1936cc-9b45-487a-8ae2-201747775faf] bash exit:1 — Slice S02 verification: all retry tests
