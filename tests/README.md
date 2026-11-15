# Eines de QA (`tests/`)

Paquet de Node a part amb les eines de qualitat del projecte: el lint de tot el repositori, la
comprovació de la cobertura i l'informe de dependències. Més endavant hi aniran les proves E2E i
d'accessibilitat (#166) i els informes de qualitat (#167).

Els tests unitaris i d'integració **no es mouen**: continuen al costat del codi que proven
(`api/test/`, `bloop4-frontend/src/**/X.test.jsx`, `db/tests/`). Aquest paquet té el seu propi
`package.json` perquè les eines de QA no toquin les dependències de l'API ni del frontend: els
pegats del Sprint 2 modifiquen aquells `package.json` i `package-lock.json`.

## Ordres

Totes s'executen des de `tests/` (la primera vegada, `npm ci`):

| Ordre | Què fa |
|---|---|
| `npm run lint` | ESLint a `api/`, `bloop4-frontend/` i `tests/`. Falla si hi ha algun error. |
| `npm run lint:fix` | El mateix, i corregeix el que es pot corregir automàticament. |
| `npm run coverage:api` | Tests de l'API amb cobertura. Amb `DATABASE_URL` comprova els llindars; sense, s'ometen els tests d'integració i només la mostra. |
| `npm run coverage:frontend` | Tests del frontend amb cobertura i comprovació dels llindars. |
| `npm run audit` | Vulnerabilitats de les dependències de producció de l'API i del frontend (`-- --include-dev` per a totes). |

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
