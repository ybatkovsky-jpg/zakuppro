# GSD context snapshot (2026-06-02T11:16:21.652Z)

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [71c33a86-269c-4737-8475-4bc6cc24c92a] bash exit:1 — Run end-to-end integration tests
- [1c3bea2a-81b2-41ca-be09-d62625bc75ef] bash exit:1 — Run Celery task unit tests
- [d85dbc14-7165-4977-b083-72c62b4e7cfe] bash exit:1 — Run payment matcher unit tests
- [00e8bb29-8442-42e7-ab4e-8d6d39b0670a] bash exit:1 — Run supplier INN extractor unit tests
- [fb5afc40-c836-4147-820a-1ba858298bab] bash exit:1 — Run integration tests for matching flow
