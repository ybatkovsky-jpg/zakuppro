# GSD context snapshot (2026-06-02T10:24:21.470Z)

## Active context
Active: M004 / S04 / T04 - Create Celery Task for Payment Matching

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [acc6f1e9-f17b-4769-85cd-df94f4dcfdd6] bash exit:1 — Run pytest for payment matcher tests
- [76642edd-e3ca-41ad-96f4-3783b07257a7] bash exit:1 — Run payment matcher verification tests
