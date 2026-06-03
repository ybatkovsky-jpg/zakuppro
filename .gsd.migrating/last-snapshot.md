# GSD context snapshot (2026-06-03T04:50:38.467Z)

## Active context
Active: M005 / S03 / T04 - Build Verification and Type Safety

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [217b4e18-f94e-4b64-adf6-201fb032fc20] bash exit:1 — Build verification for S02 completion
- [57172a8b-1896-4679-bec5-47de8cbb3be0] bash exit:1 — Build verification for S02 completion
