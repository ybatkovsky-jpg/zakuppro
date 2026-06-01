# GSD context snapshot (2026-06-01T11:20:26.072Z)

## Active context
Active: M002 / S04 / T02 - Create Supplier Resolver Module

## Top project memories
- [MEM005] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM006] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM001] (architecture) SQLAlchemy 2.0 uses relationship(back_populates=...) for bidirectional relationships, not backref. This makes relationships explicit on both sides for clearer code.
- [MEM003] (pattern) SQLAlchemy lazy="selectin" prevents N+1 queries by fetching related objects in a single additional query. Use for one-to-many relationships.
- [MEM002] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.
- [MEM004] (pattern) Pydantic v2 requires model_config = ConfigDict(from_attributes=True) for ORM mode, not the inner Config class from v1.

## Recent gsd_exec runs
- [bb93d77e-d54d-401f-8c6f-6ca22fc8098d] bash exit:1 — Verify Python syntax validation
- [88bdd060-7c6c-4635-9473-5b780547bc3a] bash exit:1 — Verify core module functions
- [dae524d0-fc5e-4465-9e71-1d9269fbb761] bash exit:1 — Verify Celery task registration
- [3a95c17b-2f2a-4770-9b77-48b8970f6a51] bash exit:1 — Verify S03 test files exist
- [e6ee96e0-d95d-48b7-a2d8-9e183112781f] bash exit:1 — Verify S03 core files exist
