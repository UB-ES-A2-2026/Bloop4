# Bloop4

Plataforma web de **lloguer de material per a esdeveniments**: so, il·luminació, mobiliari,
carpes i estructures. Els clients troben el material que necessiten per organitzar un
esdeveniment, i les empreses de lloguer hi ofereixen el seu catàleg.

## Abast del Sprint 0

El primer sprint construeix la base del catàleg i cobreix dues històries d'usuari:

| Història | Issue | Què permet |
|---|---|---|
| **US-00 · Visualitzar catàleg de productes** | #1 | Veure tots els productes amb nom, categoria, preu per dia i venedor. |
| **US-02 · Filtre del catàleg per categories** | #2 | Filtrar per una o diverses categories (Sonido, Iluminación, Mobiliario, Carpas y estructuras i les seves subcategories). |

Queden fora d'aquest sprint, i són al Product Backlog: cerca per paraula clau, filtres
compartibles per URL, fitxa de producte (imatges, fiança, assegurança), registre i inici de
sessió, reserves i pagaments.

## Stack tecnològic

| Capa | Tecnologia |
|---|---|
| Base de dades | PostgreSQL 16 |
| API | Node.js 22 · Express 5 · `pg` |
| Frontend | React 18 · Vite 5 |
| Servidor web | Nginx |
| Tests | `node:test` (API) · Vitest + Testing Library (frontend) · proves SQL (BD) |
| Contenidors | Docker · Docker Compose |
| CI | GitHub Actions |

## Equip i forma de treballar

Equip de 6 persones: Product Owner, Scrum Master, Backend, Frontend, QA i DevOps.

Treballem amb **GitHub Flow**: una branca per tasca, Pull Request amb revisió i *Squash and
merge* a `main`. El backlog i el tauler són a GitHub Issues i GitHub Projects. Les normes de
branques, commits, revisió i la Definició de Fet són a [CONTRIBUTING.md](CONTRIBUTING.md).

## Estructura del repositori

_Pendent._

## Posada en marxa

_Pendent._

## API

_Pendent._

## Model de dades

_Pendent._

## Tests

_Pendent._
