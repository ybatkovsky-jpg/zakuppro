# GSD context snapshot (2026-06-01T03:50:19.823Z)

## Top project memories
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.

## Recent gsd_exec runs
- [ce57c045-f1c6-4fa6-98a9-7edb2c1d8d14] bash exit:1 — Run all 58 model and schema tests
- [086c8607-9624-4142-bca7-c1da01ba8bdb] bash exit:1 — Verify all Pydantic schemas import successfully
- [86980f16-5862-423e-90c8-1b547e0017ab] bash exit:1 — Verify all 9 models import successfully
- [dfd9513b-0e43-4bba-aa9f-d9ce0a4f5722] bash exit:1 — Verify schemas import successfully
