# Com contribuir a Bloop4

## Flux de treball (Gitflow)

| Branca | Per a què | Com hi arriba el codi |
|---|---|---|
| `main` | Producció. Només conté sprints acabats. | PR de `dev` → `main` al final de l'sprint (i `hotfix/`). |
| `dev` | Integració de l'sprint. És la branca per defecte del repositori. | PR de cada branca d'història, després d'un rebase. |
| `<tipus>/<nº-història>-…` | **Una història d'usuari sencera**: totes les seves tasques. Viu mentre dura la història. | Surt de `dev` i hi torna per PR. |
| `hotfix/<nº-issue>-…` | Correcció urgent de producció. | Surt de `main`; PR a `main` i després a `dev`. |

Cada història d'usuari té **una sola branca**, i tothom qui té una tasca de la història hi fa els
seus commits. Les tasques (els sub-issues de la història) no tenen branca pròpia. Les històries
s'integren a `dev` d'una en una, en l'ordre que fixa l'equip a la planificació.

1. Agafa la tasca de la columna **To Do** del tauler, assigna-te-la i mou-la a **In progress**. La
   història diu quina és la seva branca (a «Metadades»).
2. Baixa la branca de la història i posa-la al dia:
   `git fetch && git switch <branca> && git pull --ff-only`.
   Si encara no existeix (ets el primer de la història), crea-la des de `dev` actualitzat i puja-la:
   `git switch dev && git pull && git switch -c <tipus>/<nº-història>-<descripcio> && git push -u origin HEAD`.
3. Fes commits petits amb [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/)
   que acabin amb `Refs #<nº-tasca>`. Una història sempre té **diversos commits, com a mínim 2**
   (normalment un o més per tasca).
4. Comprova que els tests passen i puja els commits: `git pull --rebase && git push`. Durant la
   història **no es fa mai `push --force`**: la branca és compartida.
5. Mou la tasca a **Ready** i avisa qui fa la tasca següent de la història.
6. **Final de la història**, quan totes les tasques són a la branca: qui fa l'última tasca (normalment
   QA, després de les proves) avisa l'equip, la rebasa sobre `dev` i la torna a pujar:

   ```bash
   git fetch origin
   git switch <branca> && git pull --ff-only
   git rebase origin/dev        # resol els conflictes, si n'hi ha, i torna a passar els tests
   git push --force-with-lease  # l'única vegada que es reescriu la branca
   ```

   Després del rebase, ningú no hi fa més commits sense tornar-la a baixar.
7. Obre el PR **cap a `dev`** (la plantilla es carrega sola) amb `Closes #<història>` i un
   `Closes #<tasca>` per cada tasca, i demana la revisió a una persona **que no hagi fet cap commit
   de la història**.
8. Amb 1 aprovació i la CI en verd, fes el merge amb **Create a merge commit** (squash i rebase
   estan desactivats a GitHub: el rebase es fa en local, al pas 6). La branca s'esborra sola. Fins
   que la història no és a `dev`, no comença la següent.

Una tasca que no forma part de cap història (processos, documentació) segueix el mateix camí amb
la seva pròpia branca i el número del seu issue: per exemple, `docs/117-decisions-sprint-2`.

**Hotfix:** surt de `main` actualitzat (`git switch -c hotfix/<nº-issue>-<descripcio> origin/main`),
PR cap a `main` i, un cop fusionat, un altre PR de la mateixa branca cap a `dev`, perquè `dev` també
tingui la correcció.

**Final de l'sprint:** l'Scrum Master obre el PR `dev` → `main`. Un cop fusionat, s'etiqueta
`main` amb la versió (`git tag -a v2.0.0 -m "Sprint 2" && git push origin v2.0.0`).

`main` i `dev` estan protegides: no s'hi pot fer push directe ni esborrar-les, i tot hi entra
per PR (només *merge commit*) amb 1 aprovació, els checks obligatoris de la CI en verd, totes les
converses de la revisió resoltes i la branca al dia amb `dev`. Si es puja un commit nou després
de l'aprovació, cal tornar-la a demanar.

## Branques

`<tipus>/<nº-història>-<descripcio-curta>`, en minúscules i amb guions, amb el número de l'issue
de la **història** (no el de la tasca). Exemple: `feat/70-confirmacio-reserva`.

| Tipus | Per a què |
|---|---|
| `feat/` | Funcionalitat nova (les històries d'usuari) |
| `fix/` | Correcció d'un error |
| `test/` | Tests i configuració de testing |
| `ci/` | Workflows de GitHub Actions |
| `build/` | Docker, Compose, Nginx, dependències |
| `docs/` | Documentació |
| `chore/` | Configuració del repositori i processos |
| `refactor/` | Canvis interns sense canvi de comportament |

## Commits

`tipus(àmbit): descripció en imperatiu i en minúscules`, i al cos, `Refs #<nº-tasca>`.

- Àmbits: `api`, `db`, `frontend`, `docker`, `ci`, `repo`.
- Exemples: `feat(api): afegeix el filtre per categoria a GET /api/products` · `fix(frontend): evita la doble petició en canviar de filtre`.
- El tipus del commit és el de la feina que fa (`feat`, `test`, `build`…), encara que la branca
  sigui `feat/`: una història té commits de diversos tipus.
- Com a mínim 2 commits per història. Cada commit ha de deixar la branca funcionant (els tests
  que toca, en verd).

## Revisió de codi

- El revisor és una persona que **no ha fet cap commit de la història**.
- Qui revisa comprova que la història compleix els criteris d'acceptació, que hi ha tests, que el
  codi s'entén i que no es pugen secrets.
- Comentaris amb prefix: **bloquejant**, **suggeriment** o **pregunta**.
- Objectiu: primera revisió en menys de 24 h laborables.

## Integració contínua (CI)

Hi ha dos workflows que s'executen a cada PR cap a `dev` o `main` i a cada push a aquestes branques:
[`ci.yml`](.github/workflows/ci.yml) i [`codeql.yml`](.github/workflows/codeql.yml).

| Check | Què fa |
|---|---|
| **API + BD** | Aixeca PostgreSQL 16, aplica migracions i seeds, passa les proves d'integritat de la BD i els tests de l'API amb cobertura, executa `db/queries/examples.sql` i arrenca l'API per comprovar el contracte amb les dades d'exemple (smoke test). |
| **Frontend** | `npm ci`, tests amb cobertura i `npm run build` a `bloop4-frontend/`. |
| **Lint** | ESLint a `api/`, `bloop4-frontend/` i `tests/`. Els errors bloquegen; els avisos (complexitat, accessibilitat) s'anoten al PR. |
| **E2E** | Aixeca l'aplicació sencera amb Docker Compose i hi passa les proves de Playwright (els camins principals de cada història), l'anàlisi d'accessibilitat amb axe i Lighthouse. |
| **Dependències** | Falla si el PR afegeix una dependència amb una vulnerabilitat alta o crítica, i deixa l'informe de `npm audit` al resum. |
| **CodeQL** | Anàlisi de seguretat del JavaScript i dels workflows. Els avisos surten a *Security → Code scanning* i al PR. |
| **Informe de QA** | Recull el resultat de tots els jobs i el publica com a comentari del PR (un sol comentari, que s'actualitza a cada push). |

Són obligatoris per fer el merge **API + BD**, **Frontend**, **Lint**, **Dependències** i **E2E**, i
que CodeQL no trobi cap alerta de seguretat alta o crítica. L'**Informe de QA** és informatiu.
Com que la branca ha d'estar al dia amb `dev`, quan s'hi fusiona una altra història cal tornar a
fer el rebase i el push: la CI es torna a executar sola, perquè el PR ja és obert.

Els tests fallen si la **cobertura** baixa d'aquests llindars ([`tests/quality-gates.mjs`](tests/quality-gates.mjs)):

| | Línies | Branques | Funcions |
|---|---:|---:|---:|
| API (amb PostgreSQL) | 90 % | 85 % | 85 % |
| Frontend | 80 % | 80 % | 70 % |

Cada job deixa un resum (cobertura, lint, dependències) a la pestanya *Summary* de l'execució, i
els informes complets com a artefactes. Cada nit, el workflow **Nocturn** passa les proves de
mutació, els E2E a la resta de navegadors i l'auditoria de totes les dependències, i el **tauler de
QA** (GitHub Pages) mostra l'estat de `dev` i com evoluciona. Per què es prova cada cosa i quins
llindars s'han de complir: [TESTING.md](TESTING.md).

Per saber si passarà abans de fer push, executa el mateix en local. Les eines de QA són al
paquet [`tests/`](tests/README.md) (la primera vegada, `cd tests; npm ci`):

```powershell
cd tests
npm run lint
npm run coverage:frontend
$env:DATABASE_URL = "postgres://eventrent:eventrent@localhost:5432/eventrent"   # docker compose up -d db
npm run coverage:api
cd ..
cd bloop4-frontend; npm run build; cd ..
```

I les proves E2E, amb el seu propi stack de Docker Compose (vegeu [tests/README.md](tests/README.md#proves-e2e-i-daccessibilitat)):

```powershell
cd tests
npm run e2e:up; npm run e2e; npm run e2e:down
```

Si el PR encara no està llest per revisar, obre'l com a **Draft**: la CI s'hi executa igual.
Quan falla un check, el log és a la pestanya *Checks* del PR.

Si canvieu les dades d'exemple (`db/seeds/`), actualitzeu també els recomptes del pas «Smoke
test de l'API» del workflow.

## Definició de fet (DoD)

- [ ] Compleix els criteris d'acceptació de la història.
- [ ] Tests nous o actualitzats; la CI passa (lint sense errors i cobertura per sobre dels llindars).
- [ ] La branca de la història està rebasada sobre `dev`.
- [ ] Revisat i aprovat per almenys 1 persona que no ha fet cap commit de la història.
- [ ] `docker compose up -d --build` funciona després del merge.
- [ ] Documentació actualitzada si canvia l'API, el model de dades o la manera d'arrencar el projecte.

## Tauler (GitHub Projects)

Columnes: **Backlog → To Do → In progress → Ready → Testing → Done**.

| Columna | Què hi ha |
|---|---|
| Backlog | Product Backlog, fora de l'sprint. |
| To Do | Sprint Backlog: issues de l'sprint pendents de començar. |
| In progress | Algú hi treballa a la branca de la història. |
| Ready | La tasca ja és a la branca de la història; o, per a la història, PR obert cap a `dev` pendent de revisió. |
| Testing | Fusionat a `dev`; el PO o QA en comprova els criteris d'acceptació. |
| Done | Validat. |

- El Product Owner prioritza el Backlog i escriu els criteris d'acceptació.
- L'Scrum Master actualitza el tauler cada setmana i elimina els bloquejos.
- `dev` és la branca per defecte, així que `Closes #N` tanca l'issue quan el PR entra a `dev`.

## Arrencar el projecte

```bash
cp .env.example .env
docker compose up -d --build   # http://localhost:8080
```

Més detalls al [README](README.md).
