# GSD context snapshot (2026-06-01T13:20:22.218Z)

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [12f125f7-4a4d-4874-9031-24b79e386271] bash exit:1 — Check existing imports in tasks/services
- [5bac3eba-57ea-49b4-b750-356a2188a168] bash exit:1 — List docker-compose services
- [525d00f7-2154-454c-ae88-d538a923ab73] bash exit:1 — List existing Python modules in app/
- [03832f2b-7e2e-4314-9159-e8fc730282fe] bash exit:1 — Verify telegram_notifier module imports
- [1ee74c1a-afd5-41b8-ba94-33e0a9145797] bash exit:1 — Verify supplier_resolver module imports
