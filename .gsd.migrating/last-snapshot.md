# GSD context snapshot (2026-06-01T13:57:48.925Z)

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [10ca5b92-aff9-47fc-a681-d8e22853a88d] bash exit:1 — Verify models pass with new Invoice extensions
- [fa359445-443e-43ae-98d6-dd7bcd5d54e1] bash exit:1 — Verify LLM config in .env
- [025811b0-f989-4ebc-98c6-f6e8bd88ee59] bash exit:1 — Run LLM provider unit tests
- [0b45333e-266f-4b5b-aae5-6b67d74ab07f] bash exit:1 — Verify migration SQL generation for schema changes
