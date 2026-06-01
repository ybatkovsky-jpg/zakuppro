# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 | S03 implementation | architecture | FastAPI router organization | Modular routers per entity with dedicated router files | Keeps code organized as API grows; each entity has its own router file (e.g., projects.py) with standard CRUD endpoints; main.py includes all routers. This pattern scales better than monolithic routers and makes testing easier. | false | agent |
