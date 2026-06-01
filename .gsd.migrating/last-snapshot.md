# GSD context snapshot (2026-05-31T23:24:25.126Z)

## Active context
Active: M001 / S02 / T02 - Create Pydantic v2 schemas in schemas.py

## Top project memories
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.

## Recent gsd_exec runs
- [a52959db-966b-4a6b-944c-31e111f63af0] bash exit:1 — Run migration tests to verify slice S01 completion
