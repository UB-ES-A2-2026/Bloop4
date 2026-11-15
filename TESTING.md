# Estratègia de proves de Bloop4

Com provem Bloop4: què es prova a cada nivell, amb quina eina, quan s'executa cada prova, quins
llindars ha de complir un canvi i on es veuen els resultats. És un document viu: el manté QA i
qualsevol canvi de llindar o de porta s'acorda amb l'equip.

Les ordres i els detalls de les eines són a [`tests/README.md`](tests/README.md); el flux de
treball (branques, revisió, Definició de Fet), a [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Principis

1. **No ho provem tot: provem el que fa més mal si falla.** Les zones amb més risc (pagaments,
   reserves i bloquejos d'estoc, autorització, estats del lliurament) tenen més proves i les proves
   de mutació les vigilen cada nit.
2. **Cada prova al nivell més barat que pot detectar l'error.** Moltes proves unitàries i de
   components, menys d'integració i poques de punta a punta (la piràmide). Una regla de negoci es
   prova a l'API, no amb el navegador.
3. **Resposta ràpida al PR, proves llargues més tard.** Un PR ha de tenir resposta en menys de 10
   minuts; el que tarda més (mutació, altres navegadors) s'executa cada nit.
4. **Resultats deterministes.** Una prova inestable és un bug: s'arregla o s'esborra, no
   s'ignora. Cap prova depèn d'Internet, de l'hora ni de l'ordre en què s'executa.
5. **Automatitzar el que es repeteix; les persones, per al que no es pot automatitzar.** Revisió
   de codi, proves exploratòries i acceptació del PO.
6. **La cobertura no és qualitat.** Una prova sense comprovacions pot cobrir el 100 % del codi.
   Per això, a més de la cobertura, mesurem quants errors introduïts detecten els tests (mutació).

## Nivells de prova

| Nivell | Què comprova | Eina | On viu |
|---|---|---|---|
| **Anàlisi estàtica** | Errors de codi, complexitat, accessibilitat del JSX, vulnerabilitats (SAST), dependències vulnerables, secrets | ESLint, CodeQL, revisió de dependències, `npm audit`, escaneig de secrets | `tests/eslint.config.js`, `.github/workflows/` |
| **Unitàries i de rutes (API)** | Validació, errors, autorització i forma de les respostes, amb un repositori fals | `node:test` | `api/test/*.test.js` |
| **Integració (API + PostgreSQL)** | El SQL de cada repositori contra una base de dades real: restriccions, concurrència, idempotència | `node:test` + PostgreSQL 16 | `api/test/*.integration.test.js` |
| **Integritat de la BD** | Restriccions de l'esquema de cada migració | SQL dins d'una transacció amb `ROLLBACK` | `db/tests/integrity_tests.sql` |
| **Components i hooks** | Cada pantalla i hook, amb l'API simulada | Vitest + Testing Library | `bloop4-frontend/src/**/X.test.jsx` |
| **Smoke de l'API** | L'API real arrencada amb els seeds: el contracte de cada història | bash + curl + jq | `.github/workflows/ci.yml` |
| **E2E** | Els camins principals de cada història, al navegador, amb tota l'aplicació | Playwright (Page Object Model) | `tests/e2e/` |
| **Accessibilitat** | WCAG 2.1 A i AA de cada pantalla clau | axe-core (dins dels E2E), Lighthouse | `tests/e2e/support/a11y.mjs`, `tests/lighthouserc.cjs` |
| **Mutació** | Si els tests detecten els errors que s'hi introdueixen | Stryker | `tests/stryker/` |
| **Smoke del desplegament** | Que staging i producció responen després de desplegar | curl | `.github/workflows/deploy.yml` |
| **Exploratòria i acceptació** | El que no preveuen els criteris; que la història fa el que volia el PO | Persones, a staging | Notes al PR i a la demo |

## Quan s'executa cada cosa

| Moment | Què s'executa | Temps | Bloqueja |
|---|---|---|---|
| **En local**, abans del push | `npm run lint`, `npm test` (amb `DATABASE_URL`), `npm run e2e` si es toca la UI | minuts | — |
| **PR cap a `dev`** | Lint · tests de l'API i del frontend amb cobertura · integritat de la BD · smoke de l'API · E2E + axe + Lighthouse (Chromium) · revisió de dependències · CodeQL · informe de QA al PR | < 10 min | Els checks obligatoris (vegeu «Portes») |
| **Push a `dev`** | El mateix que al PR, desplegament a staging amb Trivy i smoke, i actualització del tauler | minuts | El desplegament, si falla la CI |
| **Cada nit** | Proves de mutació · E2E a Firefox, WebKit i mòbil · `npm audit` de totes les dependències · actualització del tauler | ~30 min | No (informe) |
| **Final de sprint** (`dev` → `main`) | Tot l'anterior en verd a `dev` · sessió exploratòria de cada història a staging · acceptació del PO a la demo | dies | Sí, per acord de l'equip |
| **Producció** | Smoke després de desplegar | segons | — |

## Portes de qualitat

Els llindars són a [`tests/quality-gates.mjs`](tests/quality-gates.mjs) i són els mateixos en local
i a la CI. Estan una mica per sota del valor que teníem en posar-los: frenen una baixada, però no
obliguen a perseguir el 100 %.

| Porta | Condició | Si no es compleix |
|---|---|---|
| Tests | Tots passen | El check falla |
| Lint | 0 errors (els avisos no fan fallar) | El check falla |
| Cobertura de l'API | línies ≥ 90 %, branques ≥ 85 %, funcions ≥ 85 % | El check falla |
| Cobertura del frontend | línies ≥ 80 %, branques ≥ 80 %, funcions ≥ 70 % | El check falla |
| Accessibilitat (axe) | Cap violació *serious* ni *critical* | El check falla |
| Lighthouse | Accessibilitat ≥ 90 a cada pantalla (rendiment, bones pràctiques i SEO, avís) | El check falla |
| Dependències noves | Cap vulnerabilitat alta ni crítica a les que afegeix el PR | El check falla |
| CodeQL | Cap alerta nova d'importància alta | El check falla |
| Mutants morts | ≥ 70 % del codi cobert als mòduls crítics | Informatiu (cada nit) |
| Revisió | 1 aprovació d'algú que no ha fet cap commit de la branca | No es pot fusionar (ruleset) |

**Ruleset de `main` i `dev`.** Un check que falla només impedeix el merge si el ruleset el fa
obligatori. Decisió de l'Scrum Master (15/11/2026):

- Checks obligatoris: «API + BD», «Frontend», «Lint», «Dependències» i «E2E» (aquest últim, des
  que les proves E2E són a `dev`). L'«Informe de QA» és informatiu.
- Regla de *code scanning*: CodeQL no pot tenir alertes de seguretat altes o crítiques al PR.
- Totes les converses de la revisió resoltes abans del merge.
- La branca ha d'estar al dia amb `dev`: el que es fusiona és la combinació que ha provat la CI.
- Un commit nou després de l'aprovació la descarta: cal tornar-la a demanar.

Per canviar un llindar: PR que modifica `tests/quality-gates.mjs` amb el motiu, revisat per QA. Mai
no es baixa un llindar ni es desactiva una regla per fer passar un PR.

## Informes

- **Al PR:** un comentari «Informe de QA», que s'actualitza a cada push, amb cada comprovació, la
  diferència respecte a `dev` i els detalls (fitxers per sota del llindar, proves que fallen,
  violacions d'accessibilitat).
- **A cada execució:** el resum de cada job a la pestanya *Summary* i els informes complets com a
  artefactes (cobertura HTML, Playwright amb traces i vídeos, Lighthouse, mutació).
- **Tauler de QA** (GitHub Pages): l'estat de `dev` i l'evolució de cada mètrica (cobertura,
  nombre de tests, mutants morts, Lighthouse), amb enllaços a tots els informes. S'actualitza a
  cada push a `dev` i cada nit. És públic, com el repositori: només conté dades dels seeds.

## Com s'escriuen els tests

- Cada criteri d'acceptació té com a mínim una prova automàtica, i el `describe` porta
  l'identificador de la història (`'US-08 · …'`).
- **Valors límit** a tot el que es valida: mínim, mínim − 1, màxim i màxim + 1.
- **Màquines d'estats:** es proven les transicions permeses i les prohibides, sobretot des dels
  estats finals.
- **Autorització:** per a cada ruta protegida, sense sessió (401), amb un altre rol (403) i amb
  recursos d'un altre usuari (403 o 404).
- La preparació va a `before` / `beforeEach`, mai dins d'una prova de la qual depenen les altres.
- Els tests d'integració creen les seves dades amb claus úniques i les esborren en acabar.
- Els clients de l'API del frontend es proven amb `fetch` simulat (URL, mètode i cos); els
  components els poden substituir.
- Cada hook amb efectes té una prova que desmunta el component i comprova que s'aturen les
  peticions i els temporitzadors.
- Proves E2E: les normes són a [`tests/README.md`](tests/README.md#normes).
- Un test escrit amb ajuda d'una IA es revisa com qualsevol altre codi: ha de fallar si s'espatlla
  el que diu provar.

## Procés de QA de cada història

1. Llegir els criteris d'acceptació i fer la llista criteri → prova.
2. Revisar les proves que porten les tasques de Backend i Frontend i afegir les que falten
   (límits, autorització, concurrència).
3. Afegir el recorregut E2E de la història, amb `checkA11y` a les pantalles noves.
4. Comprovar en local la cobertura (`npm run coverage:api` i `coverage:frontend`) i, si la història
   toca mòduls crítics, les proves de mutació (`npm run mutation`).
5. Prova exploratòria a staging (uns 30 minuts), amb notes al PR.
6. Comprovar que l'informe de QA del PR està en verd abans de demanar la revisió.

## Errors (bugs)

- Tot error que arriba a `dev` es registra com a issue amb la plantilla «Bug» i passos per
  reproduir-lo.
- La correcció porta una prova que **fallava abans** de corregir-lo i passa després. Així l'error
  no torna.
- Una prova inestable es tracta igual: issue, causa i correcció.

## Responsabilitats

| Qui | Què |
|---|---|
| Qui fa una tasca | Les proves del que canvia, en el mateix commit o a la mateixa història |
| Qui revisa el PR | Que hi ha proves, que comproven el que diuen i que l'informe de QA és verd |
| QA | Aquesta estratègia, les portes i els informes, les proves E2E i la prova exploratòria de cada història |
| DevOps | Els workflows, el stack de proves i els desplegaments |
| Scrum Master | Que les portes acordades siguin obligatòries al ruleset |
| Product Owner | Els criteris d'acceptació i l'acceptació a la demo |

## Pendent

- Al Sprint 3, les regles d'accessibilitat de `jsx-a11y` passen d'avís a error, i
  `@vitest/coverage-v8` i Stryker passen a les dependències dels seus paquets (durant el Sprint 2
  s'instal·len sense desar-los perquè els pegats del sprint modifiquen aquells `package.json`).
- Treure el smoke de l'API de `ci.yml` a un script reutilitzable després de desplegar.
- Aïllar els tests d'integració (una transacció per test) perquè es puguin executar en paral·lel.
