# Shared Agent Guidance

## Project Context

Bloop4 is a web marketplace for renting event equipment (sound, lighting, furniture, tents and
structures). Customers browse the catalog; rental companies (sellers) publish their products.
The database user and name are still `eventrent`, from the project's earlier working name.

Sprint 0 delivered the catalog (US-00 #1, US-02 #2). Sprint 1 delivered keyword search (US-01),
the product detail page (US-03), sign-up and role-based login (US-13), seller product publishing
(US-10), availability for a date range (US-05), the multi-seller cart (US-06) and delivery
address and time slots (US-07). The project is now in **Sprint 2** (milestone *Sprint 2*), which
covers:

- **US-12 · Booking confirmation with a temporary stock hold** (#70)
- **US-08 · Single card payment and deposit hold** (#118)
- **US-14 · Riders accept delivery and pickup services** (#125)
- **US-15 · Rider's list of deliveries and pickups** (#131)
- **US-09 · Real-time order tracking** (#136)
- **US-11 · Delivery and pickup proof with photos and a condition checklist** (#143)
- **US-16 · Delivery tracking on a map** (#150)
- **US-04 · Verified product reviews** (#158)

Do not build ahead of the current sprint. The README lists each sprint's scope ("Abast"), and the
technical decisions of every sprint are recorded in [`skills/DATABASE.md`](skills/DATABASE.md)
(one section per sprint; Sprint 2's come from issue #117).

Read [`README.md`](../README.md) (scope, stack, API contract, data model, local setup, tests) and
[`CONTRIBUTING.md`](../CONTRIBUTING.md) (Git workflow, commits, Definition of Done) before
making changes. Database decisions are indexed in [`skills/DATABASE.md`](skills/DATABASE.md).
The detailed long-term specification it cites (`aclarations.md`) is **not in the repository**:
if a task depends on it, ask the user instead of guessing.

## Repository Map

| Path | Contents |
|---|---|
| `db/` | Numbered SQL migrations, seeds, example queries, integrity tests (`tests/`), first-run init (`docker-init/`) and Bash scripts (`migrate.sh`, `seed.sh`, `reset.sh`, `psql.sh`, `test.sh`) |
| `api/` | REST API: Node.js 22, Express 5, `pg`, ES modules |
| `bloop4-frontend/` | SPA: React 18, Vite 5, `react-router-dom`, plain CSS; `Dockerfile` and `nginx.conf` |
| `deploy/` | VM deployment: `deploy.sh`, `demo-passwords.sh` and the Caddy configuration |
| `tests/` | QA tooling as its own npm package: ESLint config, coverage thresholds (`quality-gates.mjs`) and the scripts the CI runs (`scripts/`) |
| `.github/` | CI (`ci.yml`), security analysis (`codeql.yml`) and deployment (`deploy.yml`) workflows, issue templates and PR template |
| `AI/` | This guide and agent skills |

## Tech Stack And Commands

| Layer | Technology | Commands (run inside the folder) |
|---|---|---|
| Database | PostgreSQL 16, pure SQL | `./db/migrate.sh`, `./db/seed.sh`, `./db/reset.sh`, `./db/test.sh` (run against the Compose `db` service) |
| API | Node.js 22, Express 5, `pg` | `npm run dev` (needs `DATABASE_URL`), `npm test` (`node:test`) |
| Frontend | React 18, Vite 5 | `npm run dev` (proxies `/api` to `:3000`), `npm test` (Vitest), `npm run build` |
| Web server | Nginx (in the frontend image) | Serves `dist/` and proxies `/api` to the API |
| Containers | Docker, Docker Compose | `docker compose up -d --build` (app on `:8080`, Mailpit on `:8025`) |
| CI / CD | GitHub Actions | CI on every PR and push to `dev` and `main`; deployment to the VM (staging from `dev`, production from `main`) |

**Infrastructure:** `docker-compose.yml` runs the database, the API, the frontend (Nginx) and
Mailpit; `docker-compose.prod.yml` adapts it for the VM. The first start of an empty database
applies every migration and seed (`db/docker-init/`). The README explains local setup ("Posada en
marxa") and deployment ("Desplegament"). Do not claim that the stack starts or that a deployment
works unless you ran it.

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

- `createApp({ ...repositories, mailer, config })` in `src/app.js` builds the app without opening
  ports or connections; routers are only mounted for the repositories that are passed. Inject
  fake repositories in route tests; do not require a database for them. `src/server.js` wires the
  real ones.
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

- Only the modules in `src/api/` talk to the network, through `request()` in `src/api/http.js`
  (photo uploads in `sellerApi.js` use `XMLHttpRequest` to report progress). They use relative
  `/api/...` URLs (the Vite proxy in development, Nginx in production) and turn every failure into
  an `ApiRequestError`. The session is an `httpOnly` cookie: the frontend never stores a token.
- Routes are declared in `src/App.jsx` (`react-router-dom`); pages for a role are wrapped in
  `RequireRole`, and the session comes from `AuthContext`.
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
- Each story that changes the model adds its own migration (Sprint 0 and Sprint 1: `001` to
  `008`: catalog, search, product details, users and sessions, seller products and physical
  units, availability, cart, delivery). Do not add tables or columns for features outside the
  current sprint.
- Existing decisions to preserve: `uuid` primary keys generated with `gen_random_uuid()`,
  `ON DELETE RESTRICT` foreign keys, non-blank text checks, indexes on foreign keys, money as
  `numeric(12,2)` ≥ 0 with an explicit ISO 4217 currency, and no floating point for money.
- Seeds use fixed, readable IDs (`a…` sellers, `c…` categories, `d…` products) that tests rely
  on. If you change the seeds, update the counts documented in the README and any test that
  asserts them.
- Before changing the schema, describe the affected entities, keys, constraints and migration
  impact, and follow the checklist in [`skills/DATABASE.md`](skills/DATABASE.md). Its approved
  domain model guides the schema; implement only the part the current sprint needs.
- When a change adds seeds or changes their counts, update `db/tests/integrity_tests.sql`, the
  README and the CI smoke test in the same PR.

## Testing

- Every feature or fix ships with new or updated tests in the same PR (Definition of Done).
- **Frontend:** Vitest + Testing Library + `jsdom`. Test files sit next to the file under test
  (`X.test.js` / `X.test.jsx`). Tests must not need the API: stub `fetch` or `vi.mock` the API
  client, and build data with `src/test/fixtures.js`.
- **API:** `node:test`. Route tests inject a fake repository through `createApp`. Repository
  and SQL behavior must be tested against a real PostgreSQL 16. Mocks are not enough for
  constraints.
- **Database:** check migrations and seeds by applying them to a clean database, run
  `db/tests/integrity_tests.sql` (inside a transaction that is rolled back) and use
  `db/queries/examples.sql` to sanity-check the data. Every migration adds its own integrity tests.
- **Quality gates** (see [`tests/README.md`](../tests/README.md)): run `npm run lint` and
  `npm run coverage:api` / `npm run coverage:frontend` from `tests/` before a PR. Lint errors and
  coverage below the thresholds in `tests/quality-gates.mjs` fail the CI. Do not lower a threshold
  or silence a lint rule to get to green: fix the code or the test, or ask.
- QA tooling (ESLint, coverage, future E2E) lives in `tests/` with its own `package.json`. Do not
  add QA dependencies to `api/` or `bloop4-frontend/` during Sprint 2: the sprint patches modify
  their `package.json` and lockfiles.
- Never say that tests or checks passed unless you ran them. Report the command and the result.

## Git Workflow

The team follows Gitflow as defined in `CONTRIBUTING.md`:

- `main` is production and only receives `dev` at the end of each sprint. `dev` is the
  integration branch and the repository's default branch.
- **One branch per user story**, not per task: `<type>/<story-issue-number>-<short-description>`
  (for example `feat/70-confirmacio-reserva`), created once from an up-to-date `dev`. Everyone with
  a task in the story commits to that same branch; tasks (the story's sub-issues) have no branch
  of their own. The story issue states its branch under «Metadades». Always use the real issue
  number, never a placeholder. Work that belongs to no story (process, docs) uses its own issue
  number. Valid types: `feat`, `fix`, `test`, `ci`, `build`, `docs`, `chore`, `refactor`, plus
  `hotfix/` branches created from `main` for production fixes (PR to `main`, then to `dev`).
- Before working on a story branch, update it (`git pull --ff-only`); before pushing, `git pull
  --rebase`. Never force-push a shared story branch while the story is in progress.
- A story always has several commits, at least 2 (usually one or more per task). Conventional
  Commits in Catalan: `type(scope): description in the imperative`, with `Refs #<task>` in the
  body. Scopes: `api`, `db`, `frontend`, `docker`, `ci`, `repo`. The commit type matches the work
  (`feat`, `test`, `build`…), not the branch prefix. Each commit should leave its tests green.
- When every task is on the branch, whoever made the last commit rebases it onto `origin/dev`,
  pushes with `--force-with-lease` (the only rewrite allowed) and opens one PR to `dev` with
  `Closes #<story>` and `Closes #<task>` for every task. The reviewer must not have committed to
  the story. Merge with a **merge commit** (squash and rebase merges are disabled on GitHub; the
  rebase happens locally). Stories reach `dev` one at a time, in the order the team planned.
- Never push directly to `dev` or `main`; both are protected.
- Do not commit, push or open PRs unless the user asks. Keep unrelated changes, such as
  lockfile churn from a local `npm install`, out of commits.

## Output And Handoff

- In task responses, lead with the result. Summarize the changed files and key decisions,
  state assumptions and open questions, and report the verification you performed.
- When handing work to another agent or teammate, give the goal, the files changed, the
  decisions made, the assumptions, the open questions and the checks run. Link to the relevant
  skill under `AI/skills/` instead of duplicating its procedure.
