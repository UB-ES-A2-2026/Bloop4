# Shared Agent Guidance

## Project Context

This project is EventRent, a marketplace for renting event equipment. See `aclarations.md` for the approved database-layer requirements and detailed model, including customers, sellers, riders, multi-seller events, physical inventory, and logistics. This is a database-only phase; API, frontend, authentication, and real payment-provider integration are out of scope unless the user changes that scope.

Use `aclarations.md` as the approved product/database specification and `docs/DATABASE.md` as its concise decision index and record of remaining open decisions. If the two conflict, or a proposed change contradicts an approved requirement, ask before proceeding. Do not re-ask questions already answered there or invent answers for its explicitly pending items.

## Shared Working Rules

- Read the relevant project documents and existing code before making changes.
- Preserve established project decisions and patterns. If the repository conflicts with this guide, call out the conflict and ask before making a broad change.
- Keep changes focused, maintainable, and consistent with neighboring code.
- Do not invent product behavior, business rules, schema fields, or external integrations.
- Protect user data and secrets. Never place credentials or real personal data in source control, examples, tests, or logs.
- Coordinate across agents through documented decisions and small, explicit handoffs. Do not assume another agent has implemented or approved a change.

## Clarification Policy

Ask the user for clarification whenever more than one plausible interpretation could materially change product behavior, the database model, an API contract, security, cost, or future migrations. Ask before implementing the affected part; do not hide a consequential choice in an assumption.

Bundle related questions into a short numbered list. For each question, explain the decision it affects and, when useful, offer a few concrete options with a recommended option clearly labeled. Ask only questions needed to unblock the current work. If an ambiguity is low impact and reversible, state the assumption explicitly and proceed; record it if it affects future work.

For this marketplace, use the policies already specified in `aclarations.md` for rental time boundaries, availability, pickup/return logistics, cancellation, deposits, pricing representation, and roles. Ask only about its explicitly pending items or a proposed change to a settled policy; the examples in that document are not invitations to re-decide settled requirements.

## Development Language And Output

- PostgreSQL 16 and pure SQL are the database standard for this phase. The planned migrations, seeds, example queries, and integrity tests are SQL. Python remains the default for a future backend or automation that is actually in scope; do not add an API, ORM, or framework to the database-only phase.
- Use the repository's established Python version and tooling for Python work. If not selected and the choice affects the work, ask first.
- Use type hints, clear names, small cohesive functions, standard Python formatting conventions, and established project tooling. Do not introduce a new dependency or framework without a concrete need.
- Use the repository's established language for other application layers. Do not rewrite a frontend or infrastructure layer in Python merely to satisfy the backend default.
- Write project documentation in clear, direct English unless the user requests another language.
- In task responses, lead with the result. Summarize changed files and important decisions, state assumptions or unresolved questions, and report verification performed. Be concise; do not claim tests or checks passed unless they were run.
- When providing code, include relevant paths and runnable commands where useful. Distinguish confirmed requirements from proposals.

## Database Rules

- Follow the approved entities and rules in `aclarations.md`; use `docs/DATABASE.md` as a concise index and decision record.
- The model includes deliberate redundancy for specific integrity/history requirements, including frozen event-line prices and copied reservation ranges needed by PostgreSQL exclusion constraints. Do not normalize these away without analyzing the stated invariant and proposing a correct replacement.
- Before changing a schema, describe the affected entities, relationships, constraints, and migration impact. Ask about unresolved business rules that determine those choices.
- Derive candidate keys and functional dependencies from confirmed rules; normalize relations to at least 3NF by default and document intentional denormalization and consistency mechanisms.
- Prefer deliberate primary/alternate keys, foreign keys, `NOT NULL` where required, appropriate uniqueness and check constraints, and documented deletion behavior. Enforce critical invariants in the database as well as in application validation when appropriate.
- Remember that SQL adds behavior beyond the pure relational model, including duplicate rows and three-valued `NULL` logic; specify and test engine-specific constraint semantics rather than assuming portability.
- Store timestamps consistently and make timezone assumptions explicit. Represent money without binary floating-point arithmetic and confirm currency and rounding rules before defining its representation.
- Prevent race conditions for scarce rentable inventory. The approved PostgreSQL 16 GiST exclusion constraint protects active overlapping unit reservations; availability reads remain advisory and must not replace that constraint.
- Use parameterized queries or the project's safe ORM APIs. Never concatenate untrusted input into SQL.
- Make schema changes through reviewed, versioned migrations. Do not rewrite an applied migration; add a new migration instead.
- Use PostgreSQL 16 semantics explicitly, including range types, GiST exclusion constraints, partial indexes, domains/enums, triggers, and `btree_gist` where specified. Do not describe these as portable SQL.
- Migrations are numbered, pure SQL, tracked by `schema_migrations`, and intended to be idempotent as specified. Do not modify an applied migration; verify rerun safety without allowing `IF NOT EXISTS` to hide schema drift.

## Agent Handoff

When handing work to another agent, provide the goal, files changed, decisions made, assumptions, open questions, and checks run. Link to the relevant skill under `.agents/skills/` rather than duplicating its full procedure.
