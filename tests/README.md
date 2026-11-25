# Eines de QA (`tests/`)

Paquet de Node a part amb les eines de qualitat del projecte: el lint de tot el repositori, la
comprovació de la cobertura, l'informe de dependències, les proves E2E, d'accessibilitat i de
Lighthouse, les proves de mutació i els informes de qualitat (el comentari del PR i el tauler).
L'estratègia de proves de l'equip és a [`TESTING.md`](../TESTING.md).

Els tests unitaris i d'integració **no es mouen**: continuen al costat del codi que proven
(`api/test/`, `bloop4-frontend/src/**/X.test.jsx`, `db/tests/`). Aquest paquet té el seu propi
`package.json` perquè les eines de QA no toquin les dependències de l'API ni del frontend: els
pegats del Sprint 2 modifiquen aquells `package.json` i `package-lock.json`.

## Ordres

Totes s'executen des de `tests/` (la primera vegada, `npm ci`). Cal Node 22.19 o més nou.

| Ordre | Què fa |
|---|---|
| `npm run lint` | ESLint a `api/`, `bloop4-frontend/` i `tests/`. Falla si hi ha algun error. |
| `npm run lint:fix` | El mateix, i corregeix el que es pot corregir automàticament. |
| `npm run coverage:api` | Tests de l'API amb cobertura. Amb `DATABASE_URL` comprova els llindars; sense, s'ometen els tests d'integració i només la mostra. |
| `npm run coverage:frontend` | Tests del frontend amb cobertura i comprovació dels llindars. |
| `npm run audit` | Vulnerabilitats de les dependències de producció de l'API i del frontend (`-- --include-dev` per a totes). |
| `npm run e2e:up` / `e2e:down` | Aixeca / atura (i buida) el stack de Docker Compose de les proves E2E. |
| `npm run e2e` | Proves E2E i d'accessibilitat a Chromium. `e2e:all`: també Firefox, WebKit i mòbil. |
| `npm run e2e:ui` | Les mateixes proves amb la interfície de Playwright, per veure-les i depurar-les pas a pas. |
| `npm run e2e:report` | Obre l'informe HTML de l'última execució (amb traces i vídeos de les que han fallat). |
| `npm run lighthouse` | Lighthouse sobre el catàleg, una fitxa i l'inici de sessió del stack de proves. |
| `npm run mutation` | Proves de mutació amb Stryker (API i frontend; amb `DATABASE_URL`, també els mòduls de l'API que només es proven amb BD). Tarda uns minuts. |
| `npm run qa-report` | Informe de QA a partir del que hi ha a `reports/`: el mateix que es publica al PR. |

La CI executa exactament aquests scripts (vegeu [CONTRIBUTING.md](../CONTRIBUTING.md#integració-contínua-ci)).
Cada un deixa un resum a `tests/reports/*.json`, que no es puja al repositori.

Per comprovar l'API com la CI, amb la base de dades de `docker compose up -d db`:

```powershell
cd tests
$env:DATABASE_URL = "postgres://eventrent:eventrent@localhost:5432/eventrent"
npm run coverage:api
```

L'informe HTML de cobertura queda a `bloop4-frontend/coverage/index.html`; el de l'API, en format
LCOV, a `api/coverage/lcov.info`.

## Lint

La configuració és a [`eslint.config.js`](eslint.config.js):

- **Errors** (bloquegen la CI): les regles recomanades de JavaScript, React i React Hooks (entre
  altres, variables no definides o no utilitzades i hooks cridats fora de lloc).
- **Avisos** (surten anotats al PR, no bloquegen): complexitat ciclomàtica de més de 10, funcions
  de més de 80 línies, més de 5 paràmetres o més de 4 nivells d'imbricació, les dependències dels
  `useEffect` i les regles d'accessibilitat de `jsx-a11y`.

Les regles d'accessibilitat són avisos només durant el Sprint 2: corregir-les vol dir tocar
components que els pegats del sprint també toquen. Al Sprint 3 passaran a ser errors.

Si una regla s'ha de desactivar en una línia concreta, es fa amb un comentari que digui per què:
`// eslint-disable-next-line react-hooks/exhaustive-deps -- només ha de dependre de query`.

## Cobertura

Els llindars són a [`quality-gates.mjs`](quality-gates.mjs) i són els mateixos en local i a la CI:

| | Línies | Branques | Funcions |
|---|---:|---:|---:|
| API (amb PostgreSQL) | 90 % | 85 % | 85 % |
| Frontend | 80 % | 80 % | 70 % |

- **API:** cobertura nativa de `node:test`, sense dependències noves. Node només compta els fitxers
  que algun test carrega; l'script hi afegeix la resta (com `src/server.js`) al 0 %.
- **Frontend:** Vitest amb `@vitest/coverage-v8`. Com que encara no és al `package.json` del
  frontend, l'script l'instal·la sense desar-lo (`npm install --no-save`) amb la mateixa versió que
  Vitest. Quan acabi el Sprint 2 passarà a les `devDependencies` del frontend.
- Si el camí del repositori té espais (per exemple, `Uni Stuff`), Vitest compta diferent els
  fitxers que cap test importa i la cobertura de línies del frontend surt uns 2 punts més baixa
  que a la CI.

## Dependències

A cada PR, la CI fa una **revisió de dependències**: falla si el PR afegeix una dependència amb
una vulnerabilitat alta o crítica. Les que ja hi eren no bloquegen: surten a l'informe de
`npm audit` del resum del job **Dependències**.

## Proves E2E i d'accessibilitat

Proves de punta a punta amb [Playwright](https://playwright.dev): obren el navegador contra
l'aplicació sencera (frontend, API, base de dades i correu) i fan el que faria una persona. Són
poques i cobreixen els camins principals de cada història; els detalls es proven més avall de la
piràmide, als tests de l'API i dels components.

### Com s'executen

```powershell
cd tests
npm ci
npx playwright install chromium   # només la primera vegada
npm run e2e:up                    # stack de proves: http://localhost:8180, correus a http://localhost:8125
npm run e2e
npm run e2e:down                  # quan acabis (esborra les dades del stack de proves)
```

El stack de proves és un projecte de Docker Compose a part (`bloop4-e2e`), amb els seus ports
(8180 l'aplicació, 3100 l'API, 8125 Mailpit, 5532 PostgreSQL) i els seus volums: les proves creen
comptes, cistelles i productes i no toquen les dades del `docker compose up` de cada dia. Es pot
fer servir mentre l'altre està en marxa. Abans de cada execució s'esborren els intents d'inici
de sessió del stack de proves, perquè l'API bloqueja la IP després de 5 intents fallits.

A la CI, el job **E2E** aixeca aquest mateix stack, passa les proves a Chromium i després
Lighthouse. L'informe HTML de Playwright (amb la traça, la captura i el vídeo de cada prova que
falla) és a l'artefacte `e2e` de l'execució.

### Estructura

```
e2e/
├── pages/            objectes de pàgina (Page Object Model): una classe per pantalla
├── support/          comptes, correus de Mailpit, accessibilitat, dates i imatges de prova, i els
│                     estats del Sprint 2 preparats amb SQL (db.mjs, states.mjs)
├── fixtures.mjs      test i expect amb els objectes de pàgina, un client nou i checkA11y
├── global-setup.mjs  comprova que el stack respon abans de començar
└── *.spec.mjs        un fitxer per àrea; el describe porta les històries (US-xx)
```

| Fitxer | Històries | Què comprova |
|---|---|---|
| `catalog.spec.mjs` | US-00, US-01, US-02, US-03 | Filtre per categoria, cerca sense accents, fitxa d'un producte, cerca sense resultats i fitxa inexistent |
| `auth.spec.mjs` | US-13 | Registre amb verificació pel correu, inici i tancament de sessió, contrasenya incorrecta, rutes protegides per rol |
| `booking.spec.mjs` | US-05, US-06, US-07 | Disponibilitat, cistella per venedor, adreça i franges d'entrega i recollida; codi postal fora de cobertura |
| `seller.spec.mjs` | US-10 | Esborrany, foto, publicació i aparició al catàleg |

Les històries del Sprint 2 tenen cadascuna el seu fitxer, `us-xx-<àrea>.spec.mjs` (vegeu «Afegir el
recorregut d'una història del Sprint 2»).

### Accessibilitat

`await checkA11y('nom de la pantalla')` analitza la pàgina oberta amb
[axe-core](https://github.com/dequelabs/axe-core) (WCAG 2.1 A i AA). Les violacions *serious* i
*critical* fan fallar la prova, però el recorregut continua fins al final; les *minor* i
*moderate* queden a l'informe. El resultat de cada pantalla és a l'informe HTML i a
`reports/a11y/`. Cada pantalla nova ha de passar per `checkA11y` com a mínim una vegada.

**Lighthouse** ([`lighthouserc.cjs`](lighthouserc.cjs)) passa 3 vegades per cada pantalla pública i
en pren la mediana. Només l'accessibilitat per sota de 90 fa fallar; el rendiment, les bones
pràctiques i el SEO són avisos, perquè als runners compartits les puntuacions varien d'una
execució a l'altra. Els informes HTML són a `reports/lighthouse/`.

### Normes

- Les proves importen `test` i `expect` de `e2e/fixtures.mjs`, no de `@playwright/test`.
- Els elements es localitzen pel **rol i el nom accessible** (`getByRole`, `getByLabel`), com els
  troba un lector de pantalla. Res de `data-testid` ni de selectors de CSS, tret que no hi hagi
  alternativa. Si una prova no troba un element, sovint vol dir que ha perdut l'etiqueta.
- Els objectes de pàgina tenen els localitzadors i les accions («afegir a la reserva»); les
  comprovacions van a la prova.
- Cada prova que modifica dades fa servir un **client nou** (el fixture `customer`: es registra
  per l'API i es verifica amb el correu de Mailpit). Els comptes dels seeds només es fan servir per
  als rols que no es poden crear des de l'aplicació (venedor verificat, rider, admin). Els noms que
  es creen porten un sufix únic, i les proves es poden executar en paral·lel i repetir sobre el
  mateix stack.
- Mai `waitForTimeout`: les assercions de Playwright ja esperen (`await expect(...).toBeVisible()`).
- Una prova inestable (que passa al reintent) és un bug: s'arregla, no s'ignora.

### Afegir el recorregut d'una història del Sprint 2

Forma part de la tasca «Proves i CI» de cada història. Les històries es fan en paral·lel, així que
el recorregut d'una història no pot passar per les pantalles d'una altra: l'estat que necessita
(una reserva pendent de pagament, un servei en curs, una reserva finalitzada…) es prepara amb SQL
dins del stack de proves.

1. Un fitxer `e2e/us-xx-<àrea>.spec.mjs` amb `test.describe('US-xx · …')`: el camí feliç i el cas
   d'error més important dels criteris d'acceptació.
2. L'estat, amb [`support/states.mjs`](e2e/support/states.mjs): `createBooking()` (reserva d'un
   client en qualsevol estat, amb els serveis assignats a un rider si cal) i `createRider()` (rider
   nou amb vehicle i la sessió iniciada). Fan servir clients i riders nous i dates pròpies
   (`eventDates`), així que les proves es poden executar en paral·lel i repetir sobre el mateix
   stack. Si una prova necessita la base de dades, comença amb
   `test.skip(!canUseDatabase, …)`: contra un altre entorn (`E2E_BASE_URL`) no hi ha accés.
3. Quan hi intervenen dues persones (el rider i el client), cadascuna té el seu context del
   navegador (`browser.newContext()`) i inicia la sessió amb `signIn`.
4. `checkA11y` a cada pantalla nova.
5. Casos particulars:
   - **US-08:** el stack de proves fa servir la passarel·la simulada (`PAYMENT_PROVIDER=mock`): la
     targeta `4242 4242 4242 4242` paga i la `4000 0000 0000 0002` es rebutja.
   - **US-16:** la geolocalització se simula amb el context (`geolocation` i `permissions`), i les
     tessel·les d'OpenStreetMap se substitueixen amb `context.route(…)` perquè la prova no surti a
     Internet.
   - **US-09 i US-16:** les pantalles es tornen a consultar cada pocs segons; s'espera el canvi
     amb una asserció (`await expect(...).toHaveText(...)`), mai amb un temps fix.

## Proves de mutació

[Stryker](https://stryker-mutator.io) canvia el codi d'un en un (un `>` per `>=`, un `true` per
`false`, una funció buida) i torna a passar els tests: si cap test falla, el canvi «sobreviu» i
indica un comportament que cap test comprova. Les configuracions són a [`stryker/`](stryker):

| Fitxer | Què muta | Tests |
|---|---|---|
| `api-unit.json` | Autenticació, rutes, errors, pujades, reserves, pagaments, proves de lliurament i seguiment (no els repositoris) | De rutes i mòduls, sense BD, 4 processos alhora |
| `api-db.json` | Els mòduls que només proven els tests d'integració (servei de pagaments, incidències, avisos) | Amb PostgreSQL, d'un en un |
| `frontend.json` | Tot `src/` menys els tests i `main.jsx` | Vitest, només els tests que cobreixen cada canvi |

No es muten els textos (`StringLiteral`): canviar un missatge d'error genera molts mutants que no
diuen res de la qualitat dels tests. S'executen cada nit (workflow **Nocturn**) i no bloquegen
res: l'objectiu és que els mòduls crítics superin el 70 % de mutants morts sobre el codi cobert.
L'informe HTML de cada execució diu, línia per línia, quins canvis han sobreviscut.

## Informes

- **Comentari al PR.** El job **Informe de QA** de la CI recull els resultats de tots els jobs,
  els compara amb l'últim resum de `dev` publicat al tauler i publica (o actualitza) un sol
  comentari al PR. En local, `npm run qa-report` el genera a `reports/qa-report.md`.
- **Tauler de QA.** El workflow **Tauler de QA** el publica a GitHub Pages quan acaba la CI d'un
  push a `dev` o l'execució nocturna: l'estat actual, l'evolució de les mètriques i els informes
  complets. L'historial (`data/history.json`) es llegeix de la versió publicada i hi afegeix un
  punt cada vegada. Per provar-lo en local amb els informes de `reports/`:
  `node scripts/dashboard.mjs --ci reports --out site` (i obrir `site/index.html`).
