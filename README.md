# Bloop4

Plataforma web de **lloguer de material per a esdeveniments**: so, il·luminació, mobiliari,
carpes i estructures. Els clients troben el material que necessiten per organitzar un
esdeveniment, i les empreses de lloguer hi ofereixen el seu catàleg.

## Abast

El **Sprint 0** va construir la base del catàleg: US-00 · Visualitzar el catàleg (#1) i
US-02 · Filtre per categories (#2).

El **Sprint 1** (milestone *Sprint 1*) cobreix:

| Història | Issue | Què permet |
|---|---|---|
| **US-01 · Cerca per paraula clau** | #24 | Buscar productes per nom o categoria, combinable amb el filtre. |
| **US-03 · Fitxa de producte** | #31 | Veure fotos, descripció, especificacions, fiança i assegurança d'un producte. |
| **US-13 · Registre i accés amb rol** | #37 | Crear un compte de client o de venedor, verificar-lo i iniciar sessió. |
| **US-10 · Publicació de productes** | #44 | El venedor publica productes amb fotos, unitats, pes i dimensions. |
| **US-05 · Disponibilitat per dates** | #50 | Saber quantes unitats d'un producte estan lliures en un interval. |
| **US-06 · Cistella de reserva** | #56 | Afegir productes de diversos venedors a una cistella per a un esdeveniment. |
| **US-07 · Lliurament i recollida** | #63 | Indicar l'adreça i les franges de lliurament i recollida. |

Les decisions tècniques del sprint són a [`AI/skills/DATABASE.md`](AI/skills/DATABASE.md)
(«Decisions del Sprint 1»). Queden al Product Backlog: US-12 (bloqueig d'estoc en confirmar la
reserva, depèn del pagament), pagaments, seguiment de la comanda, valoracions i proves de
lliurament.

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

Treballem amb **Gitflow**: una branca per issue que surt de `dev` i hi torna per Pull Request
(amb revisió i *merge commit*); `main` és producció i només rep `dev` al final de cada sprint.
El backlog i el tauler són a GitHub Issues i GitHub Projects. Les normes de branques, commits,
revisió i la Definició de Fet són a [CONTRIBUTING.md](CONTRIBUTING.md).

## Estructura del repositori

_Pendent._

## Posada en marxa

Amb Docker Compose n'hi ha prou amb una ordre:

```bash
docker compose up -d --build
```

L'app és a <http://localhost:8080> i els correus de desenvolupament, a <http://localhost:8025>.
La primera vegada es creen la base de dades i les dades d'exemple. Per canviar algun valor, copia
`.env.example` com a `.env`.

### Sense Docker Compose

Per aixecar cada peça a mà, cal tenir **Node.js 22**, **Docker Desktop** (en marxa) i el port 5432 lliure (si tens un
PostgreSQL instal·lat a la màquina, atura'l). Les ordres són per a PowerShell i s'executen des
de l'arrel del repositori.

**1. Base de dades** (només la primera vegada):

```powershell
docker run -d --name bloop4-db -p 5432:5432 `
  -e POSTGRES_USER=eventrent -e POSTGRES_PASSWORD=eventrent -e POSTGRES_DB=eventrent postgres:16

docker exec bloop4-db pg_isready -U eventrent   # espera fins que digui "accepting connections"

docker cp db/migrations/001_catalog.sql bloop4-db:/tmp/m.sql
docker cp db/seeds/001_catalog.sql bloop4-db:/tmp/s.sql
docker exec bloop4-db psql -U eventrent -d eventrent -v ON_ERROR_STOP=1 -f /tmp/m.sql
docker exec bloop4-db psql -U eventrent -d eventrent -v ON_ERROR_STOP=1 -f /tmp/s.sql
```

Els scripts de `db/` encara no serveixen perquè criden `docker compose`. Fem servir
`docker cp` en lloc de redirigir el fitxer amb `<`/`|` perquè PowerShell 5 trencaria els
accents de les dades d'exemple.

Les vegades següents n'hi ha prou amb `docker start bloop4-db`: les dades es conserven.
Per començar de zero: `docker rm -f bloop4-db` i repetir el pas 1.

**2. API** (terminal 1, s'ha de deixar oberta):

```powershell
cd api
npm install
$env:DATABASE_URL = "postgres://eventrent:eventrent@localhost:5432/eventrent"
npm run dev
```

Comprovació: <http://localhost:3000/api/health> → `{"status":"ok"}`.

**3. Frontend** (terminal 2, s'ha de deixar oberta):

```powershell
cd bloop4-frontend
npm install
npm run dev
```

L'app és a <http://localhost:5173>.

| Símptoma | Causa probable |
|---|---|
| `error during connect … dockerDesktopLinuxEngine` | Docker Desktop no està obert. |
| L'API registra `ECONNREFUSED` | El contenidor `bloop4-db` està aturat (`docker start bloop4-db`). |
| La pàgina no carrega | Alguna de les dues terminals (API o Vite) s'ha tancat. |
| «No se pudo conectar con el servidor» a la UI | Vite funciona, però l'API no està en marxa al port 3000. |

### Fotos dels productes

Les fotos que pugen els venedors es guarden al volum de Docker `uploads`: l'API hi escriu
(`UPLOAD_DIR=/app/uploads`) i Nginx les serveix a `/uploads/…` (només lectura). El volum es
conserva amb `docker compose down`; `docker compose down -v` l'esborra juntament amb la base de
dades. Nginx accepta cossos de fins a 11 MB a `/api/` (fotos de 10 MB com a màxim).

### Correu en desenvolupament (Mailpit)

`docker compose up` també aixeca [Mailpit](https://mailpit.axllent.org/), un servidor SMTP de
proves que **no envia res a Internet**: captura els correus de l'app (per exemple, el de
verificació del compte) i els mostra a <http://localhost:8025>. L'API hi envia els correus
segons `SMTP_HOST`, `SMTP_PORT` i `MAIL_FROM` (vegeu `.env.example`), i els enllaços es
construeixen amb `APP_URL`. Si l'API s'executa sense `SMTP_HOST`, no envia correus i només ho
avisa al log.

## Desplegament

Hi ha dos entorns a la mateixa màquina virtual, darrere de Caddy, que posa l'HTTPS:

| Entorn | Branca | Adreça | Directori a la VM |
|---|---|---|---|
| Staging | `dev` | <https://dev.bloop4.duckdns.org:5081> | `/opt/bloop4/staging` |
| Producció | `main` | <https://www.bloop4.duckdns.org:5081> | `/opt/bloop4/prod` |

Quan la CI passa en un push a `dev` o `main`, el workflow
[Deploy](.github/workflows/deploy.yml) fa això:

1. Construeix les imatges de l'API i del frontend.
2. Les escaneja amb Trivy i s'atura si hi ha alguna vulnerabilitat CRITICAL que ja tingui solució.
3. Les publica a GHCR amb les etiquetes `:<sha>` i `:dev` o `:main`.
4. Entra a la VM per SSH a través de Tailscale i executa [`deploy/deploy.sh`](deploy/deploy.sh):
   baixa les imatges, aplica les migracions pendents i aixeca l'stack.
5. Comprova que responen `/api/health`, `/api/products` i la portada.

Si algun pas falla, el motiu és al registre del workflow, a la pestanya **Actions**.

### Tornar enrere o recarregar les dades

A **Actions → Deploy → Run workflow**:

- **`ref`:** el commit que es vol desplegar. Ha de ser de la branca de l'entorn. Les migracions no
  es desfan: un canvi d'esquema ha de ser compatible amb la versió anterior.
- **`reset_db`:** esborra la base de dades i torna a carregar els seeds. Només a staging.

### Comptes d'exemple

La contrasenya dels seeds és al repositori, que és públic, i per això a la VM no serveix:
[`deploy/demo-passwords.sh`](deploy/demo-passwords.sh) la canvia a cada desplegament pel valor de
`DEMO_PASSWORD`. Demaneu-la a DevOps.

### Configuració

Cada entorn de GitHub (`staging` i `production`), que només poden fer servir `dev` i `main`, té:

| Nom | Tipus | Què és |
|---|---|---|
| `DEPLOY_HOST`, `DEPLOY_USER` | Secret | Adreça de la VM a Tailscale i usuari (`deploy`) |
| `DEPLOY_SSH_KEY` | Secret | Clau privada només per a GitHub Actions |
| `DEPLOY_KNOWN_HOSTS` | Secret | Empremta SSH de la VM |
| `TS_OAUTH_CLIENT_ID`, `TS_AUDIENCE` | Secret | Credencial de Tailscale per a l'etiqueta `tag:ci` |
| `SITE_URL` | Variable | Adreça pública, amb el port |
| `DEPLOY_DIR` | Variable | Directori de l'entorn a la VM |

A la VM, cada directori té el seu `.env`, que no va mai al repositori: `COMPOSE_PROJECT_NAME`
(`bloop4-prod` o `bloop4-staging`), `IMAGE_TAG`, `POSTGRES_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (amb cometes), `APP_URL` i `DEMO_PASSWORD`.

### Preparar la VM des de zero

1. Ubuntu 24.04 amb Docker Engine, Compose 2.24.4 o superior i Tailscale amb l'etiqueta
   `tag:bloop4`. Només s'hi arriba des d'Internet pel port 443 (el router hi envia el 5081), i la
   VM no pot obrir connexions cap a adreces privades.
2. Crear l'usuari `deploy`, dins del grup `docker`, amb la clau pública de GitHub Actions.
3. Fer que DuckDNS s'actualitzi amb la IP pública cada 5 minuts (`cron`).
4. Crear la xarxa: `docker network create bloop4-edge`.
5. Clonar el repositori a `/opt/bloop4/prod` i `/opt/bloop4/staging`, i crear-hi els `.env`.
6. Copiar `deploy/caddy/` a `/opt/bloop4/caddy`, crear-hi el `.env` a partir de `.env.example` i
   executar `docker compose up -d --build`.
7. Identificar l'usuari `deploy` a GHCR amb `docker login ghcr.io` i un token clàssic de GitHub que
   només tingui `read:packages`. Els paquets `bloop4-api` i `bloop4-frontend` són privats perquè
   l'organització no permet els públics. Quan el token caduca, els desplegaments fallen en baixar
   les imatges: cal crear-ne un de nou i repetir el `docker login`.

Caddy no el desplega el workflow. Per actualitzar-lo, cal tornar a copiar `deploy/caddy/` (sense
tocar el `.env`) i repetir el `docker compose up -d --build`.

## API

Respostes JSON en camelCase; les llistes van dins de `data`.

| Endpoint | Descripció |
|---|---|
| `GET /api/health` | `200 {"status":"ok"}` si arriba a PostgreSQL, `503` si no |
| `GET /api/categories` | Llista plana de categories amb `parentId`, `slug`, `sortOrder` i `productCount` (productes assignats directament) |
| `POST /api/auth/register` | Crea un compte pendent de verificar. Cos: `email`, `password` (8–128), `fullName`, `role` (`customer` o `seller`), `acceptTerms: true` i, si és venedor, `legalName` i `city`. Respon sempre `201` amb el mateix missatge, encara que el correu ja existeixi |
| `POST /api/auth/verify-email` | Cos `{ token }` (el de l'enllaç del correu, caduca a les 24 h). `400 TOKEN_EXPIRED` o `400 INVALID_TOKEN` si no serveix |
| `POST /api/auth/resend-verification` | Cos `{ email }`. Envia un enllaç nou si el compte està pendent; sempre respon igual |
| `POST /api/auth/login` | Cos `{ email, password }`. Crea la sessió (cookie `bloop4_session`, `HttpOnly`, `SameSite=Lax`) i retorna l'usuari. `401` genèric si falla; `429` després de 5 intents fallits en 15 min (per compte o per IP) |
| `POST /api/auth/logout` | Tanca la sessió (`204`) |
| `POST /api/auth/become-seller` | Cos `{ legalName, city }`. Afegeix el rol `seller` (i la fila de `sellers`) al compte de la sessió. Cal el correu verificat (`403`); `409` si ja és venedor |
| `GET /api/auth/me` | Usuari de la sessió: `id`, `email`, `fullName`, `status`, `roles`, `seller` (`{ id, legalName, city }` o `null`). `401` sense sessió |
| `GET /api/seller/products` | Productes del venedor de la sessió (esborranys i publicats) amb `status`, `units`, pes, mides i fotos (`[{ id, path, altText }]`). `401` sense sessió, `403` si no és venedor |
| `POST /api/seller/products` | Crea un esborrany. Obligatoris: `name` (3–120), `categoryId`, `dailyPrice` (`"45.00"`). Opcionals: `depositAmount`, `description`, `insurance`, `specs` (objecte), `units` (0–500), `weightKg`, `lengthCm`, `widthCm`, `heightCm`. Cal el correu verificat (`403`) |
| `PATCH /api/seller/products/:id` | Canvia només els camps enviats. `403` si el producte és d'un altre venedor, `404` si no existeix |
| `POST /api/seller/products/:id/images` | Puja una foto (`multipart/form-data`, camp `photo`): JPEG, PNG o WebP comprovats pel contingut, 10 MB com a màxim, 10 fotos per producte (`409`) |
| `DELETE /api/seller/products/:id/images/:imageId` | Esborra la foto i el seu fitxer (`204`) |
| `POST /api/seller/products/:id/publish` | Publica el producte. `403` si el venedor no està verificat; `400` amb `details.missing` si falta nom, categoria, una foto, preu > 0, unitats ≥ 1, pes o mides |
| `GET /api/products/:id/availability` | `from` i `to` en ISO 8601 amb zona horària (`2030-06-15T10:00:00+02:00`). Retorna `availableUnits`, `totalUnits`, `billableDays`, `totalPrice` (string) i `currency`, i si no n'hi ha cap de lliure, fins a 3 `suggestions` (`[{ from, to, availableUnits }]`) de dates properes. `400` si falta la zona, si `to` ≤ `from` o si és al passat. És informativa: no reserva res |
| `GET /api/products/:id/availability/calendar` | `month=AAAA-MM`. Retorna `unavailableDays` (`AAAA-MM-DD`, hora de Madrid): dies en què cap unitat queda lliure |
| `GET /api/cart` | Cistella del client (cal el rol `customer`): `startsAt`, `endsAt`, `billableDays`, `sellers` (`[{ seller, items, rentalSubtotal, depositSubtotal }]`), `totals` (`rental`, `deposit`, `toPay`) i `canCheckout`. Cada línia porta `warnings` (`PRICE_CHANGED`, `UNAVAILABLE`, `UNPUBLISHED`) si s'ha de revisar. Una cistella sense canvis durant 7 dies caduca |
| `PUT /api/cart` | Cos `{ startsAt, endsAt }` (ISO 8601 amb zona). Crea la cistella o en canvia les dates; totes les línies es revaliden |
| `POST /api/cart/items` | Cos `{ productId, quantity }` (1–500). Si el producte ja hi és, suma les quantitats. `409 CONFLICT` amb `details.availableUnits` si no n'hi ha prou |
| `PATCH /api/cart/items/:id` | Cos `{ quantity }` amb la quantitat final (idempotent). També accepta el preu actual del producte |
| `DELETE /api/cart/items/:id` | Esborra la línia (`204`). `403` si és d'un altre client |
| `GET /api/products/:id` | Fitxa d'un producte: les dades del llistat més `description`, `depositAmount` (string), `insurance` (`null` = sense assegurança), `specs` (objecte) i `images` (`[{ path, altText }]`, ordenades). `400` si l'id no és un UUID, `404` si no existeix |
| `GET /api/products` | Productes paginats. `categoryId` (UUID separats per comes; inclou les subcategories), `q` (cerca de 2 a 100 caràcters), `page` (≥ 1), `pageSize` (1–100, per defecte 24) |

```json
{
  "data": [{
    "id": "d0000000-…-0001",
    "name": "Altavoz activo 12\" 1300 W",
    "dailyPrice": "45.00",
    "currency": "EUR",
    "category":       { "id": "…", "name": "Altavoces", "slug": "altavoces" },
    "parentCategory": { "id": "…", "name": "Sonido",    "slug": "sonido" },
    "seller": { "id": "…", "legalName": "Sonido Levante S.L.", "city": "Valencia" }
  }],
  "pagination": { "page": 1, "pageSize": 24, "totalItems": 15, "totalPages": 1 }
}
```

**Cerca (`q`)**: busca al nom del producte i al de la seva categoria i categoria arrel, sense
tenir en compte majúscules ni accents (`microfono` troba «Micrófono») i tolerant errors lleus
(`microfno`). Els resultats s'ordenen per rellevància. Es combina amb `categoryId`: amb
categories seleccionades només es busca dins d'aquestes. Fa servir `unaccent`, `pg_trgm` i el
full-text `spanish` de PostgreSQL ([`002_product_search.sql`](db/migrations/002_product_search.sql)).

Errors: `{ "error": { "code", "message", "details?" } }` amb `400 VALIDATION_ERROR`,
`404 NOT_FOUND` o `500 INTERNAL_ERROR` (sense detalls interns).

## Frontend

SPA amb React 18 i Vite 5 a [`bloop4-frontend/`](bloop4-frontend/), sense router ni
llibreria d'estat: de moment és una sola pantalla (el catàleg).

```
bloop4-frontend/src/
├── api/catalogApi.js        Client HTTP: fetchCategories(), fetchProducts()
├── hooks/useProducts.js     Estat de la llista: càrrega, paginació, reintents
├── components/
│   ├── Catalog.jsx          Pantalla del catàleg (comptador, graella, "Cargar más")
│   ├── ProductCard.jsx      Targeta: nom, categoria, preu/dia i venedor
│   ├── ProductGridSkeleton  Placeholder mentre carrega
│   ├── StatusPanel.jsx      Estats buit i d'error, amb botó opcional
│   └── Navbar.jsx
├── theme/visuals.js         Color, forma i glif de cada targeta (només presentació)
└── index.css                Tots els estils, agrupats per secció
```

### Com parla amb l'API

- El frontend sempre crida rutes relatives `/api/...`. En desenvolupament, el **proxy de
  Vite** ([`vite.config.js`](bloop4-frontend/vite.config.js)) les envia a
  `http://localhost:3000`. En producció ho farà Nginx. Per això no hi ha CORS ni URLs
  absolutes al codi.
- Per apuntar el proxy a una altra API: `$env:API_PROXY_TARGET = "http://…"` abans de
  `npm run dev`. Per saltar-se el proxy i cridar directament una URL: `VITE_API_URL`
  (necessitaria CORS a l'API).
- [`catalogApi.js`](bloop4-frontend/src/api/catalogApi.js) converteix qualsevol error en un
  `ApiRequestError` amb `status`, `code` i el `message` que retorna l'API. Si no es pot
  connectar, el missatge és «No se pudo conectar con el servidor». Els components mostren
  aquest `message` directament.
- `useProducts(categoryIds)` demana les pàgines de 24 en 24. Si canvia el filtre, la llista
  es reinicia, i les respostes que arriben tard (d'un filtre o d'una pàgina anteriors) es
  descarten. Cada petició es pot avortar amb `AbortController`.

### Convencions

- **Textos de la UI en castellà**, igual que les dades (noms de categories i productes).
  **Comentaris del codi en català.**
- `dailyPrice` arriba com a string (`"45.00"`) i només es converteix a número per
  formatar-lo (`Intl.NumberFormat`, `es-ES`). No s'hi fa aritmètica.
- El color de cada targeta depèn del `slug` de la categoria **arrel**
  (`ROOT_CATEGORY_HUE` a [`visuals.js`](bloop4-frontend/src/theme/visuals.js)). Una
  categoria arrel nova agafa el color per defecte fins que s'afegeixi allà.
- Els estils surten del disseny final (`Bloop4.html`). Aquest fitxer **no és al repositori**
  (és al `.gitignore`): demaneu-lo a l'equip. Les classes de CSS reprodueixen els seus valors.

### Estat actual i següents passos

| Feina | Estat |
|---|---|
| US-00 · Catàleg (llistat, paginació, estats de càrrega/buit/error) | Fet i provat contra l'API real |
| US-02 · Filtre per categories | **Pendent.** Ja existeixen `fetchCategories()`, `useProducts(categoryIds)` (ja accepta el filtre) i els estils a `index.css` («Filtre de categories»). Falta el component i substituir `NO_FILTER` a `Catalog.jsx` per l'estat del filtre. |
| Tests del frontend | Base feta (vegeu [Tests](#tests)). Cada funcionalitat nova hi afegeix els seus. |
| Dockerfile + Nginx | Fet. Nginx serveix `dist/` i redirigeix `/api` a l'API. |

## Model de dades

Base de dades PostgreSQL 16. L'esquema del catàleg és a
[`db/migrations/001_catalog.sql`](db/migrations/001_catalog.sql) i només conté el que
necessiten US-00 i US-02: categories, venedors i productes.

```mermaid
erDiagram
  categories |o--o{ categories : "parent_id"
  categories ||--o{ products   : "category_id"
  sellers    ||--o{ products   : "seller_id"
```

| Taula | Camps | Regles |
|---|---|---|
| `categories` | `id`, `parent_id`, `name`, `slug`, `sort_order` | Arbre de 2 nivells via `parent_id` (`NULL` = categoria arrel). `slug` únic, en minúscules i amb guions; el frontend fa servir el de l'arrel per triar el color de les targetes. `sort_order` fixa l'ordre dins del filtre. |
| `sellers` | `id`, `legal_name`, `city` | Només el que mostra la targeta de producte: «raó social · ciutat». |
| `products` | `id`, `seller_id`, `category_id`, `name`, `daily_price`, `currency`, `description`, `deposit_amount`, `insurance`, `specs` | `daily_price` i `deposit_amount` són `numeric(12,2)` i ≥ 0 (mai `float`); `currency` és un codi ISO 4217 (per defecte `EUR`). `description` i `insurance` poden ser `NULL` però no buits (`insurance` `NULL` = sense assegurança). `specs` és un objecte JSON. |
| `users` | `id`, `email`, `password_hash`, `full_name`, `status`, `email_verified_at`, `created_at` | `email` únic i en minúscules. Contrasenya com a hash `scrypt`. `status`: `pending_verification`, `active` (necessita `email_verified_at`) o `suspended`. |
| `roles`, `user_roles` | `code`, `name` · `user_id`, `role` | Un usuari pot tenir diversos rols (`customer`, `seller`, `rider`, `admin`). |
| `sellers.user_id` | | Usuari que gestiona el venedor (únic). |
| `sessions`, `email_verification_tokens` | `token_hash`, `user_id`, `expires_at`, … | Només es guarda el hash SHA-256 del token. |
| `login_attempts`, `terms_consents` | | Intents d'inici de sessió (per al límit) i versió dels termes acceptada per cada usuari. |
| `products` (005) | `status`, `weight_kg`, `length_cm`, `width_cm`, `height_cm` | `status`: `draft` o `published`; el catàleg públic només mostra els publicats. Pes i mides > 0. |
| `sellers.verified`, `warehouses` | `verified` · `id`, `seller_id`, `name`, `city` | Només un venedor verificat pot publicar. Cada venedor té els seus magatzems. |
| `product_units` | `id`, `product_id`, `seller_id`, `warehouse_id`, `status` | Una fila per unitat física (`available`, `maintenance`, `retired`). FK compostes: la unitat, el producte i el magatzem són del mateix venedor. |
| `sellers.prep_margin` | | Marge de preparació entre lloguers (per defecte 2 h), abans i després de cada reserva. |
| `events`, `event_items` | `customer_id`, `status`, `starts_at`, `ends_at` · `event_id`, `product_id`, `quantity` | Esdeveniment = comanda del client (`draft` = cistella, `confirmed`, `cancelled`…). Una línia per producte. |
| `event_item_units` | `event_item_id`, `unit_id`, `reserved_period`, `is_active` | Unitat física reservada en un interval semiobert `[inici, fi)`. Índex GiST `(unit_id, reserved_period)` de les reserves actives. Una unitat està lliure si és `available` i no té cap reserva activa que se solapi amb l'interval ampliat amb el marge. Dies facturables: blocs de 24 h arrodonits a l'alça (mínim 1). |
| `event_items` (007) | `daily_price`, `deposit_amount`, `currency`, `insurance`, `added_at` | Còpia (snapshot) del preu, la fiança, la moneda i l'assegurança en el moment d'afegir la línia; un trigger les copia del producte si no s'informen. |
| `events` (007) | `updated_at` | Última activitat de la cistella (caduca als 7 dies). Índex únic parcial: com a molt un `draft` per client. |
| `product_images` | `id`, `product_id`, `path`, `alt_text`, `sort_order` | Ruta pública absoluta del fitxer (el serveix Nginx). Una imatge per posició dins de cada producte (`UNIQUE (product_id, sort_order)`). |

Decisions comunes:

- Totes les claus primàries són `uuid` generats amb `gen_random_uuid()`.
- Les claus foranes són `ON DELETE RESTRICT`: no es pot esborrar una categoria o un venedor
  que encara té productes (ni una categoria amb subcategories).
- Els textos obligatoris no poden ser buits (`CHECK (btrim(...) <> '')`).
- Hi ha índexs a `categories.parent_id`, `products.category_id` i `products.seller_id`.
- Filtrar per una categoria pare inclou els productes de les seves subcategories (consulta
  recursiva; vegeu [`db/queries/examples.sql`](db/queries/examples.sql)).

### Dades d'exemple

[`db/seeds/001_catalog.sql`](db/seeds/001_catalog.sql) carrega **2 venedors, 14 categories
(4 arrels i 10 subcategories) i 15 productes**. Els IDs són fixos i llegibles
(`a…` venedors, `c…` categories, `d…` productes) per poder-los referenciar als tests.

| Categoria | Subcategories |
|---|---|
| Sonido | Altavoces · Mesas de mezclas · Microfonía |
| Iluminación | Focos LED · Cabezas móviles · Efectos especiales |
| Mobiliario | Sillas · Mesas |
| Carpas y estructuras | Carpas · Escenarios y tarimas |

### Scripts

Els scripts de `db/` executen `psql` dins del servei `db` de Docker Compose i llegeixen
`.env` si existeix.

| Script | Què fa |
|---|---|
| `./db/migrate.sh` | Aplica en ordre les migracions pendents i les registra a `schema_migrations`. Cada fitxer va en una sola transacció. |
| `./db/seed.sh` | Carrega les dades d'exemple. Falla si ja estan carregades. |
| `./db/reset.sh` | Esborra l'esquema `public` i torna a fer migrate + seed. **Només per a desenvolupament.** |
| `./db/psql.sh` | Obre una sessió de `psql`, o executa el SQL que rep per stdin. |

Per comprovar les dades amb el projecte en marxa:

```bash
./db/psql.sh < db/queries/examples.sql
```

Ha de mostrar els 15 productes, els 5 de Sonido (incloent-hi les subcategories) i les 14
categories amb el recompte de productes.

Les migracions aplicades no es modifiquen mai: qualsevol canvi d'esquema va en una migració
nova (`002_…sql`).

## Tests

### Frontend

```powershell
cd bloop4-frontend
npm test            # una passada (és el que farà la CI)
npx vitest          # mode watch mentre es desenvolupa
```

Vitest amb `jsdom` i Testing Library, configurat a
[`vite.config.js`](bloop4-frontend/vite.config.js). Els tests van al costat del fitxer que
proven (`X.test.js` / `X.test.jsx`) i **no necessiten l'API ni la base de dades**: es
simula `fetch` o es mocka `catalogApi` amb `vi.mock`.

| Fitxer | Què cobreix |
|---|---|
| `api/catalogApi.test.js` | URL i paràmetres de les peticions, i conversió d'errors (HTTP, xarxa, resposta inesperada, abort) |
| `hooks/useProducts.test.js` | Filtre normalitzat, abort i descart de respostes antigues en canviar de filtre o de cerca, `hasMore` |
| `components/SearchBar.test.jsx` | Avís de menys de 2 caràcters, botó de borrar i límit de 100 caràcters |
| `components/Catalog.test.jsx` | Estats de càrrega, buit i error, "Reintentar" i "Cargar más" (també quan falla la pàgina 2), filtre i cerca amb debounce |
| `components/ProductCard.test.jsx` | Contingut de la targeta i format del preu (`45 €`, `3,50 €`) |
| `theme/visuals.test.js` | Glif de mida o categoria, color per categoria arrel, forma estable |

Per crear productes de prova, feu servir `makeProduct()` i `makePage()` de
[`src/test/fixtures.js`](bloop4-frontend/src/test/fixtures.js).

### API

```powershell
cd api
npm test                                                                  # 9 tests de rutes (sense BD)
$env:DATABASE_URL = "postgres://eventrent:eventrent@localhost:5432/eventrent"
npm test                                                                  # + 4 d'integració amb SQL real (13)
```

Fan servir el runner de Node (`node --test`), sense dependències extra.

| Fitxer | Què cobreix |
|---|---|
| `test/catalog.test.js` | Rutes amb un repositori fals: paginació per defecte, `categoryId` múltiple i sense duplicats, validació (UUID, `page`, `pageSize`), errors 400/404/500 sense detalls interns i `/api/health` |
| `test/catalogRepository.integration.test.js` | SQL real contra la BD amb els seeds: recomptes de categories, filtre jeràrquic (un pare inclou les filles), paginació sense repetir ni saltar productes i forma del JSON. S'omet si no hi ha `DATABASE_URL` |

### Base de dades

Proves d'integritat de l'esquema sobre el contenidor `bloop4-db` de la
[Posada en marxa](#posada-en-marxa). S'executen dins d'una transacció que acaba en
`ROLLBACK`: no modifiquen les dades.

```powershell
docker cp db/tests/integrity_tests.sql bloop4-db:/tmp/t.sql
docker exec bloop4-db psql -U eventrent -d eventrent -X -q -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Ha d'acabar amb `Totes les proves han passat.` Cobreixen 11 casos: recompte dels seeds, arbre
de dos nivells, una categoria no és el seu propi pare, slug únic i en kebab-case, preus no
negatius, moneda ISO de tres lletres, FK de categoria i de venedor, i que no es poden esborrar
categories ni venedors amb productes. Quan hi hagi `docker-compose.yml`, també es podran
executar amb `./db/test.sh`.

### CI

A cada PR cap a `dev` o `main`, el job **API + BD** de GitHub Actions aplica la migració i els seeds, executa les
proves d'integritat i després els tests de l'API amb `DATABASE_URL` (els 13).
