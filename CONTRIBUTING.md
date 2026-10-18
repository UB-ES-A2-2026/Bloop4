# Com contribuir a Bloop4

## Flux de treball (GitHub Flow)

1. Agafa un issue de la columna **Sprint Backlog** del tauler, assigna-te'l i mou-lo a **In progress**.
2. Crea la teva branca des de `main` actualitzat: `git switch main && git pull && git switch -c <tipus>/<nº-issue>-<descripcio>`.
3. Fes commits petits amb [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
4. Abans d'obrir el PR: `git fetch && git rebase origin/main` i comprova que els tests passen.
5. Obre el PR (la plantilla es carrega sola), enllaça l'issue amb `Closes #N` i demana la revisió a una altra persona.
6. Amb 1 aprovació i la CI en verd, fes el merge amb **Squash and merge** i esborra la branca.

No es fa mai push directe a `main`: tot hi entra per PR.

## Branques

`<tipus>/<nº-issue>-<descripcio-curta>`, en minúscules i amb guions. Exemple: `feat/6-catalogo-frontend`.

| Tipus | Per a què |
|---|---|
| `feat/` | Funcionalitat nova |
| `fix/` | Correcció d'un error |
| `test/` | Tests i configuració de testing |
| `ci/` | Workflows de GitHub Actions |
| `build/` | Docker, Compose, Nginx, dependències |
| `docs/` | Documentació |
| `chore/` | Configuració del repositori i processos |
| `refactor/` | Canvis interns sense canvi de comportament |

## Commits

`tipus(àmbit): descripció en imperatiu i en minúscules`

- Àmbits: `api`, `db`, `frontend`, `docker`, `ci`, `repo`.
- Exemples: `feat(api): afegeix el filtre per categoria a GET /api/products` · `fix(frontend): evita la doble petició en canviar de filtre`.

## Revisió de codi

- Qui revisa comprova que fa el que diu l'issue, que hi ha tests, que el codi s'entén i que no es pugen secrets.
- Comentaris amb prefix: **bloquejant**, **suggeriment** o **pregunta**.
- Objectiu: primera revisió en menys de 24 h laborables.

## Integració contínua (CI)

El workflow és a [`.github/workflows/ci.yml`](.github/workflows/ci.yml) i s'executa a cada PR
cap a `main` i a cada push a `main`. Té dos jobs, que són els checks obligatoris per fer el
merge:

| Check | Què fa |
|---|---|
| **API + BD** | Aixeca PostgreSQL 16, passa `npm test` de l'API, aplica migracions i seeds, executa `db/queries/examples.sql` i arrenca l'API per comprovar el contracte amb les dades d'exemple (14 categories, 15 productes, filtre per categoria i error 400). |
| **Frontend** | `npm ci`, `npm test` i `npm run build` a `bloop4-frontend/`. |

Per saber si passarà abans de fer push, executa el mateix en local:

```powershell
cd bloop4-frontend; npm ci; npm test; npm run build; cd ..
cd api; npm ci; npm test; cd ..
```

Si el PR encara no està llest per revisar, obre'l com a **Draft**: la CI s'hi executa igual.
Quan falla un check, el log és a la pestanya *Checks* del PR.

Si canvieu les dades d'exemple (`db/seeds/`), actualitzeu també els recomptes del pas «Smoke
test de l'API» del workflow.

## Definició de fet (DoD)

- [ ] Compleix els criteris d'acceptació de l'issue.
- [ ] Tests nous o actualitzats; la CI passa.
- [ ] Revisat i aprovat per almenys 1 persona.
- [ ] `docker compose up -d --build` funciona després del merge.
- [ ] Documentació actualitzada si canvia l'API, el model de dades o la manera d'arrencar el projecte.

## Tauler (GitHub Projects)

Columnes: **Product Backlog → Sprint Backlog → In progress → In review → Done**.

- El Product Owner prioritza el Product Backlog i escriu els criteris d'acceptació.
- L'Scrum Master actualitza el tauler cada setmana i elimina els bloquejos.
- Automatitzacions activades al projecte (Workflows integrats): *Item added to project → Product Backlog*, *Item closed → Done*, *Pull request merged → Done*. El pas a **In progress** i a **In review** es fa a mà (qui crea la branca o obre el PR).

## Arrencar el projecte

```bash
cp .env.example .env
docker compose up -d --build   # http://localhost:8080
```

Més detalls al [README](README.md).
