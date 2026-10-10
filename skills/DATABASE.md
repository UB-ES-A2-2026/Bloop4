# Database Decision Record

This file indexes the approved database requirements and records unresolved decisions. The detailed product and model specification is [`../aclarations.md`](../aclarations.md); read it before proposing schema changes. If this summary and the detailed specification conflict, pause and ask the user which is current.

## Confirmed Scope And Technology

- Product: EventRent, a marketplace for renting event equipment.
- Current phase: database layer only. No API, frontend, authentication, authorization, or real payment-provider integration.
- Database: PostgreSQL 16.
- Database artifacts: numbered, pure-SQL migrations (001-008 in the approved specification), realistic seeds, example queries, integrity tests run inside transactions and rolled back, plus local development scripts.
- Python is the default for a future backend or automation when that work is in scope; it does not replace SQL for this database phase.

## Approved Domain Model

The detailed ER diagram, table attributes, state flows, and constraints are in `aclarations.md`. Key facts agents must preserve include:

- Users can hold multiple roles; seller, rider, and customer profiles are role-specific. A user can be both seller and customer.
- An event is the customer order and can contain products from multiple sellers.
- `products` are catalog descriptions; `product_units` are physical inventory. Availability is derived from unit status and active overlapping reservations, not stored as a rented unit status.
- A reservation blocks a physical unit for its full out-and-back logistics interval when deliveries are scheduled, not just the event interval. Ranges are half-open `[start, end)`.
- PostgreSQL `EXCLUDE` with GiST prevents active overlapping reservations of a unit. `btree_gist` supports combining UUID equality and range overlap. Conflicts use SQLSTATE `23P01`.
- Event-line prices, deposits, and currency are snapshots so later catalog changes do not rewrite historical bookings. Reservation ranges are copied onto the assignment relation so the exclusion constraint can enforce overlap; triggers keep the copy synchronized.
- Composite foreign keys enforce consistency between products, sellers, warehouses, event lines, and assigned units. Preserve these declarative constraints when editing related triggers or tables.
- Money uses the approved `money_amount` domain (`NUMERIC(12,2)` with non-negative check) and each amount has an explicit currency. Do not use floating point.
- PostgreSQL-specific partial indexes, range types, exclusion constraints, domains, enums, triggers, views, and `timestamptz` are intentional, not portability bugs.

This is the baseline, not permission to invent additional behavior. Consult the source specification for exact fields, constraints, deletion rules, sample data, and examples.

## Relational Modeling Standard

For every proposed relation, state its row grain (what one row represents), attributes and domains, candidate key(s), selected primary key, alternate/business keys, and known functional dependencies. Derive these from confirmed business rules, not sample data. A generated UUID does not replace a real-world uniqueness rule.

Derive functional dependencies from rules that hold for every valid database state, not from sample correlations. Compute candidate keys from them, and distinguish prime attributes (part of a candidate key) from non-prime attributes. Use these tests: 1NF uses values in declared domains rather than nested/repeating relation structure; 2NF rules out non-prime attributes depending on a proper subset of a candidate key; 3NF requires every nontrivial FD determinant to be a superkey or its dependent attribute to be prime; BCNF requires every nontrivial FD determinant to be a superkey; 4NF requires every nontrivial multivalued-dependency determinant to be a superkey. State dependencies and the highest normal form claimed.

Use 3NF as the default target, but verify decompositions are lossless and preserve dependencies where practical. Consider BCNF or 4NF when confirmed dependencies warrant them. Explain intentional denormalization, the anomaly or invariant it addresses, and how duplicated facts remain consistent.

Distinguish the conceptual relational model from SQL implementation details. PostgreSQL query results use bag semantics unless duplicates are removed, and three-valued logic for `NULL`. A PostgreSQL `CHECK` rejects `FALSE` but accepts `UNKNOWN`; default `UNIQUE` treats nulls as distinct (PostgreSQL also supports `NULLS NOT DISTINCT`). Document optional/unknown values intentionally and verify partial-index and constraint-timing behavior. Indexes support access paths; they do not replace integrity constraints.

## Open Decisions

These are explicitly unresolved in `aclarations.md`; do not silently choose answers:

- Billable-day calculation (calendar days, 24-hour periods, weekend rates, or another policy) and the booking-line snapshot fields needed for the approved calculation.
- Whether and how the database will enforce event and delivery state transitions. The current state diagrams are intended flows, not currently database-enforced transition rules.
- Rider schedule overlap prevention, validation against recurring availability, and vehicle-capacity enforcement.
- Whether to introduce vendor suborders and their acceptance/settlement lifecycle.
- Future scope and design for invoices/taxes, partial damage charges/refunds, audit history, immutable address snapshots, PostGIS/geospatial search, configurable preparation margins, and catalog full-text search.
- Any new requirement not covered by the approved specification, including changes to roles, booking policy, retention, or payment handling.

Ask concise clarification questions when work depends on one of these decisions. Do not reopen settled requirements such as the PostgreSQL version, multi-role users, physical-unit inventory, half-open ranges, or the current phase boundary unless the user asks to change them.

## Schema Change Checklist

- Read `aclarations.md`, the current schema, migration history, examples, and tests before changing the model.
- State row grain, candidate/business keys, functional dependencies, cardinalities, and the normal-form rationale.
- Preserve the specified composite foreign keys, partial uniqueness rules, checks, deletion semantics, and historical snapshots.
- For denormalized values, document the invariant and the trigger/transaction that synchronizes them.
- For reservations, verify full logistics blocking periods, `[start, end)` boundary semantics, active-state predicate, and exclusion-constraint behavior.
- Design SQL migrations for PostgreSQL 16, preserve the numbered history, and verify both migration tracking and idempotent reruns; do not let `IF NOT EXISTS` conceal drift.
- Test constraints and concurrency on PostgreSQL 16, including exclusion conflicts and SQLSTATE `23P01`; mocks alone are insufficient.
- Update this record and `aclarations.md` only when the user approves a change to requirements or decisions.
