# Shared Agent Guidance

## Project Context

Bloop4 is a web marketplace for renting event equipment (sound, lighting, furniture, tents and
structures). Customers browse the catalog; rental companies (sellers) publish their products.
The database user and name are still `eventrent`, from the project's earlier working name.

Sprint 0 delivered the catalog (US-00 #1, US-02 #2). The project is now in **Sprint 1**
(milestone *Sprint 1*), which covers:

- **US-01 · Keyword search** (#24)
- **US-03 · Product detail page** (#31)
- **US-13 · Sign-up and role-based login** (#37)
- **US-10 · Sellers publish products** (#44)
- **US-05 · Availability for a date range** (#50)
- **US-06 · Multi-seller booking cart** (#56)
- **US-07 · Delivery address and time slots** (#63)

US-12 (stock hold on checkout), payments, order tracking, reviews and delivery proofs are in the
Product Backlog. Do not build ahead of the current sprint. The technical decisions taken for
Sprint 1 are recorded in [`skills/DATABASE.md`](skills/DATABASE.md) ("Sprint 1 Decisions").

Read [`README.md`](../README.md) (scope, stack, API contract, data model, local setup, tests) and
[`CONTRIBUTING.md`](../CONTRIBUTING.md) (Git workflow, commits, Definition of Done) before
making changes. Database decisions are indexed in [`skills/DATABASE.md`](skills/DATABASE.md).
The detailed long-term specification it cites (`aclarations.md`) is **not in the repository**:
if a task depends on it, ask the user instead of guessing.

## Repository Map

| Path | Contents |
|---|---|
| `db/` | Numbered SQL migrations, seeds, example queries and Bash scripts (`migrate.sh`, `seed.sh`, `reset.sh`, `psql.sh`) |
| `api/` | REST API: Node.js 22, Express 5, `pg`, ES modules |
| `bloop4-frontend/` | SPA: React 18, Vite 5, plain CSS |
| `.github/` | Issue templates, PR template and (once added) GitHub Actions workflows |
| `AI/` | This guide and agent skills |

## Tech Stack And Commands

| Layer | Technology | Commands (run inside the folder) |
|---|---|---|
| Database | PostgreSQL 16, pure SQL | `./db/migrate.sh`, `./db/seed.sh`, `./db/reset.sh` (need Docker Compose) |
| API | Node.js 22, Express 5, `pg` | `npm run dev` (needs `DATABASE_URL`), `npm test` (`node:test`) |
| Frontend | React 18, Vite 5 | `npm run dev` (proxies `/api` to `:3000`), `npm test` (Vitest), `npm run build` |
| Web server | Nginx (planned) | Serves `dist/` and proxies `/api` to the API |
| Containers | Docker, Docker Compose (planned) | `docker compose up -d --build` |
| CI | GitHub Actions | Runs on every PR and push to `dev` and `main` |

**Infrastructure status:** `docker-compose.yml`, the Dockerfiles, Nginx and `.env.example` do
not exist yet, even though `CONTRIBUTING.md` and the `db/` scripts already assume them. Until
they are added, follow the provisional manual setup in the README ("Posada en marxa"). Do not
claim that `docker compose` works or that it was verified.

Do not add a new language, framework, ORM, router, state library or dependency without a
concrete need, and ask first. In particular, the backend is Node.js. Do not introduce Python or
another backend stack.

## Shared Working Rules

- Read the relevant documents and existing code before making changes.
- Preserve established decisions and patterns. If the repository conflicts with this guide,
  point out the conflict and ask before making a broad change.
- Keep changes focused, maintainable and consistent with neighboring code.
- Do not invent product behavior, business rules, schema fields, API fields or external
  integrations.
- Protect user data and secrets. Never put credentials or real personal data in source control,
  examples, tests or logs. `.env` files are git-ignored; only `.env.example` may be committed.
- Coordinate through documented decisions and small, explicit handoffs. Do not assume another
  team member or agent has implemented or approved a change.

## Clarification Policy

Ask before implementing when more than one plausible interpretation would materially change
product behavior, the database model, the API contract, security, cost or future migrations.
Bundle related questions into a short numbered list, explain what each decision affects, and
offer concrete options with a recommended one. If an ambiguity is low-impact and reversible,
state your assumption and proceed.

## Language Conventions

| What | Language |
|---|---|
| Project documentation (`README.md`, `CONTRIBUTING.md`), commit messages, code comments | Catalan |
| User-facing text: UI labels, API error `message`s, log messages | Spanish |
| Sample data (category and product names) | Spanish |
| Identifiers, JSON fields, file names | English |
| Agent guidance (`AI/`) | English |

## API Rules (`api/`)

- `createApp({ catalogRepository })` in `src/app.js` builds the app without opening ports or
  connections. Inject a fake repository in route tests; do not require a database for them.
- Repositories (`src/repositories/`) are the only layer that knows the SQL schema. They return
  objects that already have the JSON contract's shape. Routes validate input and shape
  responses; they do not contain SQL.
- Always use parameterized queries (`$1`, `$2`, ...). Never concatenate input into SQL.
- JSON is camelCase. Lists go inside `data`; paginated lists add
  `pagination: { page, pageSize, totalItems, totalPages }`.
- Errors always have the shape `{ "error": { "code", "message", "details?" } }`. Throw
  `ApiError` / `validationError` from `src/errors.js`. Unexpected errors become
  `500 INTERNAL_ERROR` without internal details.
- Validate query parameters strictly (see `parsePositiveInt` and `parseCategoryIds` in
  `src/routes/catalog.js`). Express 5 forwards rejected async handlers to the error handler,
  so no `try/catch` wrappers are needed in routes.
- Money (`NUMERIC`) is returned as a decimal string (`"45.00"`). Do not convert it to a float.
- Any change to the API contract must update the API section of the README and the frontend
  client in the same PR.

## Frontend Rules (`bloop4-frontend/`)

- Only `src/api/catalogApi.js` calls `fetch`. It uses relative `/api/...` URLs (the Vite proxy
  in development, Nginx in production) and turns every failure into an `ApiRequestError`.
- Data-loading hooks (`src/hooks/`) must cancel stale requests (`AbortController`) and ignore
  responses that no longer match the current request.
- `dailyPrice` stays a string until it is formatted with `Intl.NumberFormat('es-ES')`. Do not
  do arithmetic with it.
- All styles live in `src/index.css`, grouped by section and using BEM-style class names
  (`card__media`, `empty-state__title`). The values come from the final design (`Bloop4.html`,
  which is git-ignored). Reuse existing classes before adding new ones.
- Card colors are keyed by the root category `slug` in `src/theme/visuals.js`.
- Keep components accessible: semantic elements, `role="status"` / `role="alert"` for state
  messages, and labels for icon-only or decorative elements.

## Database Rules (`db/`)

- PostgreSQL 16, pure SQL. Migrations are numbered (`001_...sql`), tracked in
  `schema_migrations`, and each file runs in a single transaction. **Never modify a migration
  that has already been applied**: add a new one.
- The current schema (`001_catalog.sql`) covers only what US-00 and US-02 need: `categories`
  (a two-level tree), `sellers` and `products`. Do not add tables or columns for features
  outside the current sprint.
- Existing decisions to preserve: `uuid` primary keys generated with `gen_random_uuid()`,
  `ON DELETE RESTRICT` foreign keys, non-blank text checks, indexes on foreign keys, money as
  `numeric(12,2)` ≥ 0 with an explicit ISO 4217 currency, and no floating point for money.
- Seeds use fixed, readable IDs (`a…` sellers, `c…` categories, `d…` products) that tests rely
  on. If you change the seeds, update the counts documented in the README and any test that
  asserts them.
- Before changing the schema, describe the affected entities, keys, constraints and migration
  impact, and follow the checklist in [`skills/DATABASE.md`](skills/DATABASE.md). Its
  long-term model (reservations, physical units, logistics) guides future sprints but is not
  approved for implementation yet.

## Testing

- Every feature or fix ships with new or updated tests in the same PR (Definition of Done).
- **Frontend:** Vitest + Testing Library + `jsdom`. Test files sit next to the file under test
  (`X.test.js` / `X.test.jsx`). Tests must not need the API: stub `fetch` or `vi.mock` the API
  client, and build data with `src/test/fixtures.js`.
- **API:** `node:test`. Route tests inject a fake repository through `createApp`. Repository
  and SQL behavior must be tested against a real PostgreSQL 16. Mocks are not enough for
  constraints.
- **Database:** check migrations and seeds by applying them to a clean database, and use
  `db/queries/examples.sql` to sanity-check the data.
- Never say that tests or checks passed unless you ran them. Report the command and the result.

## Git Workflow

The team follows Gitflow as defined in `CONTRIBUTING.md`:

- `main` is production and only receives `dev` at the end of each sprint. `dev` is the
  integration branch and the repository's default branch.
- One short-lived branch per issue, created from an up-to-date `dev`, named
  `<type>/<issue-number>-<short-description>`. Always use the real issue number, never a
  placeholder. Valid types: `feat`, `fix`, `test`, `ci`, `build`, `docs`, `chore`, `refactor`,
  plus `hotfix/` branches created from `main` for production fixes.
- Conventional Commits in Catalan: `type(scope): description in the imperative`. Scopes:
  `api`, `db`, `frontend`, `docker`, `ci`, `repo`.
- Every branch reaches `dev` through a PR with `Closes #N`, one approval and green CI, merged
  with a **merge commit** (squash and rebase are disabled). Never push directly to `dev` or
  `main`; both are protected.
- Do not commit, push or open PRs unless the user asks. Keep unrelated changes, such as
  lockfile churn from a local `npm install`, out of commits.

## Output And Handoff

- In task responses, lead with the result. Summarize the changed files and key decisions,
  state assumptions and open questions, and report the verification you performed.
- When handing work to another agent or teammate, give the goal, the files changed, the
  decisions made, the assumptions, the open questions and the checks run. Link to the relevant
  skill under `AI/skills/` instead of duplicating its procedure.
