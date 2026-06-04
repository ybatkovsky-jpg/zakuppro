# GSD context snapshot (2026-06-04T10:14:29.134Z)

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [94bbda83-be1a-4a5b-b317-cccbb5f70b1f] python exit:0 — S02 verification: combined stock + transition service tests
- [a45f46be-d12b-453d-9e7c-1154c5a622ef] python exit:0 — S02 verification: transition service tests via Python 3.12
- [c46f1f5c-06b9-49fc-ab2f-de32ca557d54] python exit:0 — S02 verification: transition + stock service tests
- [88c88c7c-97ff-41e4-85e7-2e115a98fe05] python exit:0 — S02 verification: transition service tests
- [b9e376a8-7fb9-464d-b35b-640816589fff] bash exit:1 — S02 verification: transition service tests
