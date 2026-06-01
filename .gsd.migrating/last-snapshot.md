# GSD context snapshot (2026-06-01T21:55:40.070Z)

## Active context
Active: M003 / S04 / T06 - Create integration tests for verification

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [0f192c85-2e1e-4419-ade0-4c4bf9df1e6e] bash exit:1 — Verify pdfplumber dependency added
- [7025d05c-2ec9-4f39-afed-4d74808ef2e6] bash exit:1 — Verify test fixtures exist
- [4eb32192-414c-471d-ba46-17879146e1b1] bash exit:1 — Verify S03 integration tests pass
- [a2b0390e-6c83-48f1-af85-8ad6a589715d] bash exit:1 — Verify invoice parser unit tests pass
