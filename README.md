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

El **Sprint 2** (milestone *Sprint 2*) cobreix:

| Història | Issue | Què permet |
|---|---|---|
| **US-12 · Confirmació de la reserva** | #70 | Convertir la cistella en una reserva i bloquejar les unitats 15 minuts mentre es paga. |
| **US-08 · Pagament i fiança** | #118 | Pagar amb targeta en una sola operació i retenir la fiança sense cobrar-la. |
| **US-14 · Acceptació de serveis pel rider** | #125 | El rider veu els lliuraments i recollides disponibles i n'accepta. |
| **US-15 · Llista de serveis del rider** | #131 | El rider consulta els seus serveis per dia, amb l'adreça i el material. |
| **US-09 · Seguiment de la comanda** | #136 | El client segueix l'estat dels lliuraments i recollides i rep avisos. |
| **US-11 · Prova de lliurament** | #143 | El rider registra fotos i l'estat del material; les incidències retenen la fiança. |
| **US-16 · Seguiment en un mapa** | #150 | El client veu en un mapa on és el rider durant el lliurament. |
| **US-04 · Valoracions** | #158 | Consultar i deixar valoracions verificades dels productes llogats. |

Les decisions tècniques de cada sprint són a [`AI/skills/DATABASE.md`](AI/skills/DATABASE.md)
(«Sprint 1 Decisions» i «Sprint 2 Decisions»).

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

Treballem amb **Gitflow**: una branca per història d'usuari, on tothom qui hi té tasques fa els
seus commits; en acabar, es rebasa sobre `dev` i hi torna per Pull Request (amb revisió i *merge
commit*). `main` és producció i només rep `dev` al final de cada sprint.
El backlog i el tauler són a GitHub Issues i GitHub Projects. Les normes de branques, commits,
revisió i la Definició de Fet són a [CONTRIBUTING.md](CONTRIBUTING.md).

## Estructura del repositori

| Carpeta | Contingut |
|---|---|
| [`api/`](api/) | API REST (Node.js 22, Express 5). `src/routes/` valida les peticions i dona forma a les respostes, `src/repositories/` és l'únic lloc amb SQL, i `src/auth/`, `src/mail/` i `src/uploads/` hi donen suport. Tests a `test/`. |
| [`bloop4-frontend/`](bloop4-frontend/) | SPA (React 18, Vite 5) i la imatge de Nginx que la serveix (`Dockerfile`, `nginx.conf`). Vegeu [Frontend](#frontend). |
| [`db/`](db/) | Migracions numerades, seeds, consultes d'exemple, proves d'integritat (`tests/`) i scripts (`migrate.sh`, `seed.sh`, `reset.sh`, `psql.sh`, `test.sh`). `docker-init/` ho aplica tot la primera vegada. |
| [`deploy/`](deploy/) | Desplegament a la VM: `deploy.sh`, `demo-passwords.sh` i la configuració de Caddy. |
| [`.github/`](.github/) | Workflows de CI i de desplegament, i plantilles d'issue i de PR. |
| [`AI/`](AI/) | Instruccions per als agents d'IA (`AGENTS.md`) i registre de decisions tècniques (`skills/DATABASE.md`). |
| `docker-compose.yml` · `docker-compose.prod.yml` | L'stack local (BD, API, frontend i Mailpit) i els canvis per a la VM. |

## Posada en marxa

Amb Docker Compose n'hi ha prou amb una ordre:

```bash
docker compose up -d --build
```

L'app és a <http://localhost:8080> i els correus de desenvolupament, a <http://localhost:8025>.
La primera vegada es creen la base de dades i les dades d'exemple. Per canviar algun valor, copia
`.env.example` com a `.env`.

### API i frontend fora de Docker (per desenvolupar)

Per treballar amb recàrrega automàtica, la base de dades pot anar amb Docker Compose i l'API i el
frontend, a mà. Cal **Node.js 22**, **Docker Desktop** en marxa i el port 5432 lliure (si tens un
PostgreSQL instal·lat a la màquina, atura'l). Les ordres són per a PowerShell i s'executen des de
l'arrel del repositori.

**1. Base de dades:**

```powershell
docker compose up -d db
```

La primera vegada s'apliquen totes les migracions i els seeds (`db/docker-init/`). Les dades es
conserven entre arrencades. Per començar de zero: `./db/reset.sh` (des de Git Bash) o
`docker compose down -v` i tornar a aixecar-la. Les migracions noves d'una branca s'apliquen amb
`./db/migrate.sh`.

**2. API** (terminal 1, s'ha de deixar oberta):

```powershell
cd api
npm install
$env:DATABASE_URL = "postgres://eventrent:eventrent_dev@localhost:5432/eventrent"
npm run dev
```

Sense `SMTP_HOST`, l'API no envia correus: només avisa al log (per veure'ls a Mailpit, fes servir
l'stack sencer amb Docker Compose).

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
| L'API registra `ECONNREFUSED` | La base de dades no està en marxa (`docker compose up -d db`). |
| La pàgina no carrega | Alguna de les dues terminals (API o Vite) s'ha tancat. |
| «No se pudo conectar con el servidor» a la UI | Vite funciona, però l'API no està en marxa al port 3000. |

### Fotos dels productes

Les fotos que pugen els venedors es guarden al volum de Docker `uploads`: l'API hi escriu
(`UPLOAD_DIR=/app/uploads`) i Nginx les serveix a `/uploads/…` (només lectura). El volum es
conserva amb `docker compose down`; `docker compose down -v` l'esborra juntament amb la base de
dades. Nginx accepta cossos de fins a 11 MB a `/api/` (fotos de 10 MB com a màxim).

<!-- Sprint 2: cada història afegeix aquí el que cal per posar-la en marxa, dins de la seva zona. -->
<!-- US-11 -->
### Fotos de les proves de lliurament

Les fotos que fan els riders en completar un servei (US-11) són dades privades: es guarden al volum
`proofs` (`PROOF_DIR=/app/proofs`), que **només munta l'API**. Nginx no les pot servir; les retorna
`GET /api/proofs/photos/:id` després de comprovar que qui les demana és el rider, el client, el
venedor o un administrador. Com `uploads`, el volum es conserva amb `docker compose down` i
s'esborra amb `docker compose down -v`. A la VM, cada entorn té el seu volum (el nom porta el
`COMPOSE_PROJECT_NAME`), i no cal cap canvi a Caddy: les fotos passen per `/api/`.

<!-- US-16 -->
<!-- fi de les zones -->

### Correu en desenvolupament (Mailpit)

`docker compose up` també aixeca [Mailpit](https://mailpit.axllent.org/), un servidor SMTP de
proves que **no envia res a Internet**: captura els correus de l'app (per exemple, el de
verificació del compte) i els mostra a <http://localhost:8025>. L'API hi envia els correus
segons `SMTP_HOST`, `SMTP_PORT` i `MAIL_FROM` (vegeu `.env.example`), i els enllaços es
construeixen amb `APP_URL`. Si l'API s'executa sense `SMTP_HOST`, no envia correus i només ho
avisa al log.

<!-- Sprint 2: cada història hi afegeix els correus que envia, dins de la seva zona. -->
<!-- US-12 -->
<!-- fi de les zones -->

<!-- US-08 -->
### Pagaments en desenvolupament

Per defecte (`PAYMENT_PROVIDER=mock`) es paga amb una **passarel·la simulada**: no cal cap compte ni
clau. «Pagar con tarjeta» obre una pàgina de proves de la mateixa app on s'escriu una targeta de
test: `4242 4242 4242 4242` paga, `4000 0000 0000 0002` es rebutja i `4000 0000 0000 0341` paga però
rebutja després la retenció de la fiança.

Per provar-ho amb **Stripe en mode de proves**:

1. Crea una clau de proves al Dashboard de Stripe (millor una clau restringida `rk_test_…` amb
   permís d'escriptura a Checkout Sessions, PaymentIntents i Refunds que no pas la `sk_test_…`).
2. Amb la [Stripe CLI](https://docs.stripe.com/stripe-cli), reenvia els webhooks a l'API local:
   `stripe listen --forward-to localhost:3000/api/payments/webhook`. T'imprimeix el secret `whsec_…`.
3. Posa-ho al `.env` (que no va mai al repositori) i torna a aixecar l'API:

   ```
   PAYMENT_PROVIDER=stripe
   STRIPE_SECRET_KEY=rk_test_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```

Les dades de la targeta s'introdueixen sempre a la pàgina de Stripe: no passen per l'API ni es
desen a la base de dades.

<!-- fi de les zones -->

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

<!-- Sprint 2: cada història hi afegeix la seva configuració dels entorns, dins de la seva zona. -->
<!-- US-08 -->
Pagaments (US-08): `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET` (claus **de proves** de Stripe;
`PAYMENT_PROVIDER` és `stripe` per defecte a la VM).

**Webhook de Stripe.** A Stripe (Developers → Webhooks) cal un *endpoint* per entorn que apunti a
`<SITE_URL>/api/payments/webhook` amb els esdeveniments `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` i
`checkout.session.expired`. El secret de signatura (`whsec_…`) de cada endpoint és el
`STRIPE_WEBHOOK_SECRET` del `.env` d'aquell entorn. No cal tocar Caddy ni Nginx: `/api/*` ja arriba a
l'API, i la petició s'autentica amb la signatura, no amb la sessió.

<!-- fi de les zones -->

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
| `GET /api/delivery-slots` | `postalCode` (5 dígits) i `date` (`AAAA-MM-DD`). Franges de 2 h (08:00–22:00, hora de Madrid) per a la cistella del client, amb `available` (hi ha capacitat a tots els venedors i falten com a mínim 24 h). `400 OUT_OF_COVERAGE` amb `details.sellers` si algun venedor no reparteix al codi postal |
| `PUT /api/cart/delivery` | Cos `{ street, postalCode, city, accessInstructions?, deliveryStartsAt, pickupStartsAt }`. El lliurament ha d'acabar abans de l'inici de l'esdeveniment i la recollida començar després del final. Tria el vehicle de cada venedor pel pes i el volum i en desa el preu. `GET /api/cart` retorna aleshores `delivery`, `totals.transport` i `readyForPayment` |
| `GET /api/products/:id` | Fitxa d'un producte: les dades del llistat més `description`, `depositAmount` (string), `insurance` (`null` = sense assegurança), `specs` (objecte) i `images` (`[{ path, altText }]`, ordenades). `400` si l'id no és un UUID, `404` si no existeix |
| `GET /api/products` | Productes paginats. `categoryId` (UUID separats per comes; inclou les subcategories), `q` (cerca de 2 a 100 caràcters), `page` (≥ 1), `pageSize` (1–100, per defecte 24) |

**Sprint 2.** Les reserves del client les fan servir diverses històries (fonaments). Totes les rutes `/api/rider` demanen el rol `rider` amb el vehicle (`403` si no en té). Cada història té la seva taula.

| Endpoint | Descripció |
|---|---|
| `GET /api/bookings` | Reserves del client (`id`, `bookingNumber`, `status`, `holdExpiresAt`, `confirmedAt`, `startsAt`, `endsAt`), de la més recent a la més antiga |
| `GET /api/bookings/:id` | Reserva amb `sellers` (línies com a la cistella), `delivery` i `totals` (`rental`, `deposit`, `transport`, `toPay`) congelats. `403` si és d'un altre client, `404` si no existeix |
| `GET /api/rider/services/:id` | Un servei del rider. `404` si no existeix o és d'un altre rider |

<!-- Sprint 2: cada història afegeix aquí la seva taula, dins de la seva zona (vegeu CONTRIBUTING.md). -->
<!-- US-12 -->
<!-- US-08 -->

#### Pagament i fiança (US-08)

| Endpoint | Descripció |
|---|---|
| `POST /api/bookings/:id/payment` | Inicia el pagament d'una reserva `pending_payment` i retorna `checkoutUrl`, la pàgina de la passarel·la on el client paga (`amount` = lloguer + transport, calculat al servidor). Si ja hi ha un pagament en curs, retorna el mateix. `409` si la reserva no està pendent (`NOT_PENDING`) o el bloqueig ha caducat (`HOLD_EXPIRED`) |
| `GET /api/bookings/:id/payment` | Estat del pagament: `status` (`none`, `pending`, `succeeded`, `failed`, `cancelled`, `refunded`), `amount`, `receiptNumber`, `paidAt`, `failureReason`, `checkoutUrl` (mentre està en curs) i `deposit` (`null` si no hi ha fiança): `{ status, amount, scheduledFor, heldAt, releasedAt }` amb `status` `scheduled` (es retindrà 7 dies abans del lliurament), `held`, `released` o `failed` |
| `POST /api/payments/webhook` | Avisos de la passarel·la, autenticats per la signatura (`Stripe-Signature`), sense sessió. La reserva només passa a `confirmed` aquí. `400 INVALID_SIGNATURE` si la signatura no és vàlida; els avisos repetits s'ignoren |
| `POST /api/payments/mock/complete` | Només amb `PAYMENT_PROVIDER=mock`: cos `{ ref, cardNumber }` amb una targeta de prova (`4242 4242 4242 4242` paga, `4000 0000 0000 0002` es rebutja). El servidor signa l'avís i el processa com un webhook; respon `{ result: 'succeeded' | 'failed' }` |

<!-- US-14 -->
<!-- US-15 -->

#### Llista de serveis del rider (US-15)

| Endpoint | Descripció |
|---|---|
| `GET /api/rider/services` | Serveis assignats al rider de la sessió. Amb `date=AAAA-MM-DD` (hora de Madrid), els d'aquell dia en qualsevol estat; sense, els propers actius. Cada servei porta `status`, `timeWindow`, `address`, `customer`, `items`, `bookingNumber` i `changedSinceAssigned` (la franja, l'estat o el vehicle han canviat després d'acceptar-lo) |

<!-- US-09 -->
<!-- US-11 -->

#### Prova de lliurament i recollida (US-11)

| Endpoint | Descripció |
|---|---|
| `POST /api/rider/services/:id/photos` | El rider puja una foto (`multipart/form-data`: `photo` i `eventItemId`, la línia de producte) d'un servei seu **en curs** (`409 NOT_IN_TRANSIT` si no). JPEG, PNG o WebP comprovats pel contingut, 10 MB com a màxim, 40 fotos per servei. Retorna `{ id, eventItemId, url }`. També `GET` (fotos pujades) i `DELETE /photos/:photoId` mentre no s'ha completat |
| `POST /api/rider/services/:id/complete` | Cos `{ items: [{ eventItemId, condition, note? }] }` amb `condition` `correct`, `damaged` o `incomplete` (si no és correcte, `note` és obligatòria). Cal l'estat de **totes** les línies i almenys una foto de cadascuna (`400` amb `details.missing`); si no, el servei no es completa. Passa el servei a `delivered` i avisa el client. Si alguna línia no és correcta, es crea una incidència i s'avisa el venedor i els administradors. Quan s'han fet totes les recollides, la reserva passa a `completed` i, si no hi ha incidències obertes, s'allibera la fiança |
| `POST /api/rider/services/:id/incident` | El rider no pot completar un servei en curs: cos `{ kind, description, photoId? }` amb `kind` `customer_absent`, `damaged`, `missing` o `other`. El servei passa a `incident` (no es dona per completat) i s'avisa el client, el venedor i els administradors (`201`) |
| `GET /api/services/:id/proof` | Prova d'un servei: `completedAt`, `items` (`[{ name, quantity, condition, note, photos: [{ id, url }] }]`) i `incidents`. La poden veure el rider del servei, el client de la reserva, el venedor i els administradors; per a la resta, `404` |
| `GET /api/proofs/photos/:id` | Una foto d'una prova, amb les mateixes regles d'accés (`404` si no es pot veure). Les fotos són a `PROOF_DIR`, que Nginx no serveix |
| `GET /api/seller/services` | Rol `seller`: els serveis del venedor (`id`, `type`, `status`, `timeWindow`, `bookingNumber`, `hasProof`, `openIncidents`), per consultar-ne les proves |
| `GET /api/admin/incidents` | Rol `admin`. Incidències (les obertes primer; filtre `status=open\|resolved`) amb la reserva, el tipus de servei i el venedor |
| `POST /api/admin/incidents/:id/resolve` | Rol `admin`. Cos `{ note }`. Resol la incidència; si la reserva ja s'ha completat i no en queda cap d'oberta, s'allibera la fiança. `409` si ja estava resolta |

<!-- US-16 -->
<!-- US-04 -->
<!-- fi de les zones -->


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

SPA amb React 18, Vite 5 i `react-router-dom` a [`bloop4-frontend/`](bloop4-frontend/), sense
llibreria d'estat. Les rutes són a [`App.jsx`](bloop4-frontend/src/App.jsx); les pàgines de cada
rol van dins de `RequireRole`, i la sessió de l'usuari la carrega `AuthContext` en obrir l'app.

```
bloop4-frontend/src/
├── App.jsx            Rutes de l'app
├── api/               Clients de l'API: http.js (request i ApiRequestError) i un fitxer per àrea
├── auth/              AuthContext (sessió) i RequireRole (pàgines per rol)
├── pages/             Una pantalla per ruta: fitxa, cistella, inici de sessió, panell del venedor…
├── components/        Peces de les pàgines: catàleg, filtre, cerca, disponibilitat, lliurament…
├── hooks/             Càrrega de dades amb cancel·lació (useProducts, useProduct, useAvailability…)
├── lib/               Utilitats sense React: preus, dates, arbre de categories
├── theme/visuals.js   Color, forma i glif de cada targeta (només presentació)
├── test/              Configuració de Vitest i fixtures
└── index.css          Tots els estils, agrupats per secció
```

### Com parla amb l'API

- El frontend sempre crida rutes relatives `/api/...`. En desenvolupament, el **proxy de
  Vite** ([`vite.config.js`](bloop4-frontend/vite.config.js)) les envia a
  `http://localhost:3000`. En producció ho farà Nginx. Per això no hi ha CORS ni URLs
  absolutes al codi.
- Per apuntar el proxy a una altra API: `$env:API_PROXY_TARGET = "http://…"` abans de
  `npm run dev`. Per saltar-se el proxy i cridar directament una URL: `VITE_API_URL`
  (necessitaria CORS a l'API).
- Totes les peticions passen per `request()` de [`http.js`](bloop4-frontend/src/api/http.js),
  que converteix qualsevol error en un `ApiRequestError` amb `status`, `code`, `details` i el
  `message` que retorna l'API. Si no es pot connectar, el missatge és «No se pudo conectar con el
  servidor». Els components mostren aquest `message` directament. (Les fotos es pugen amb
  `XMLHttpRequest`, a `sellerApi.js`, per poder mostrar el progrés.)
- La sessió és una cookie `httpOnly` del mateix origen: el frontend no guarda mai cap token.
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

## Model de dades

Base de dades PostgreSQL 16. L'esquema es construeix amb les migracions numerades de
[`db/migrations/`](db/migrations/), una per cada història que canvia el model. El diagrama mostra
el nucli del catàleg; la taula, totes les taules i les regles que les protegeixen.

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
| `seller_postal_codes`, `sellers.delivery_capacity` | `seller_id`, `postal_code` · capacitat | Codis postals on reparteix cada venedor (sense PostGIS) i quants lliuraments o recollides pot fer per franja de 2 h. |
| `vehicle_types` | `code`, `name`, `max_weight_kg`, `max_volume_m3`, `price` | `cargo_bike`, `car`, `van`, `truck`. Es tria el més barat on hi cap la càrrega del venedor. **Els límits i els preus són d'exemple: els ha de confirmar el Product Owner.** |
| `addresses`, `events.address_id` | `user_id`, `street`, `postal_code`, `city`, `access_instructions` | Dada personal: només la veu el client (i, més endavant, venedors i riders de la comanda). Cap adreça real als seeds. |
| `deliveries`, `event_transport` | `event_id`, `seller_id`, `delivery_type`, `time_window`, `vehicle_type`, `status` · `price` | Un lliurament i una recollida per venedor i esdeveniment; el preu del transport (un servei per venedor) es congela a `event_transport`. |
| `product_images` | `id`, `product_id`, `path`, `alt_text`, `sort_order` | Ruta pública absoluta del fitxer (el serveix Nginx). Una imatge per posició dins de cada producte (`UNIQUE (product_id, sort_order)`). |

**Sprint 2.** L'esquema comú ([`009_base_sprint2.sql`](db/migrations/009_base_sprint2.sql)) té el que fan servir diverses històries; cada història té la seva migració (010–017), que només depèn de la 009 i del Sprint 1.

| Taula | Camps | Regles |
|---|---|---|
| `events` (009) | `hold_expires_at`, `booking_number`, `confirmed_at` | Una reserva és un esdeveniment que ja no és la cistella: `pending_payment` (unitats bloquejades fins a `hold_expires_at`), `confirmed` i `completed`. El número de reserva (`B4-AAAA-NNNNNN`) l'assigna un trigger. |
| `riders`, `deliveries` (009) | `user_id`, `vehicle_type` · `rider_id`, `assigned_at`, `changed_at` | Perfil del rider (usuari amb el rol `rider`, comprovat per un trigger) i el seu vehicle. Un servei (`deliveries`) `pending` no té rider; `assigned`, `in_transit` i `delivered` sí. `changed_at` és l'últim canvi de la franja, l'estat o el vehicle (trigger): si és posterior a `assigned_at`, el rider veu que el servei s'ha modificat. |
| `notifications` | `user_id`, `kind`, `title`, `body`, `link`, `created_at`, `read_at` | Avisos dins de l'aplicació (els creen el seguiment i les incidències). `link` només pot ser una ruta de l'app (`/reservas/…`). |

<!-- Sprint 2: cada història afegeix aquí la seva taula, dins de la seva zona (vegeu CONTRIBUTING.md). -->
<!-- US-12 -->
<!-- US-08 -->

#### Pagament i fiança (US-08)

| Taula | Camps | Regles |
|---|---|---|
| `payments` | `event_id`, `provider`, `provider_ref`, `checkout_url`, `charge_ref`, `customer_ref`, `amount`, `currency`, `status`, `receipt_number`, `paid_at` | Un intent de cobrament d'una reserva a la passarel·la (`mock` o `stripe`). `status`: `pending`, `succeeded`, `failed`, `cancelled` o `refunded`. Índexs únics parcials: com a molt un pagament en curs i un de completat per reserva. **Cap dada de targeta.** |
| `deposit_holds` | `event_id`, `amount`, `currency`, `status`, `scheduled_for`, `provider_ref`, `held_at`, `released_at` | Retenció de la fiança (una per reserva): `scheduled` (es farà 7 dies abans del lliurament), `held`, `released` o `failed`. |
| `payment_webhook_events` | `provider`, `event_ref` | Avisos de la passarel·la ja processats (idempotència del webhook). |

<!-- US-14 -->
<!-- US-15 -->

#### Llista de serveis del rider (US-15)

| Taula | Camps | Regles |
|---|---|---|
| `deliveries` (013) | índex | Índex `(rider_id, lower(time_window))` per a la llista del rider. |

<!-- US-09 -->
<!-- US-11 -->

#### Prova de lliurament i recollida (US-11)

| Taula | Camps | Regles |
|---|---|---|
| `proof_photos` | `delivery_id`, `event_item_id`, `path`, `content_type` | Fotos de les proves (US-11), en un directori privat (`PROOF_DIR`), no a `/uploads/`. Un trigger comprova que la línia és del mateix servei. |
| `delivery_proofs`, `proof_items` | `delivery_id`, `rider_id`, `completed_at` · `event_item_id`, `condition`, `note` | Prova d'un servei completat i checklist de cada línia (`correct`, `damaged`, `incomplete`; si no és correcte, cal una nota). |
| `incidents` | `delivery_id`, `kind`, `description`, `photo_id`, `status`, `resolved_at`, `resolved_by` | Incidències d'un servei (`damaged`, `missing`, `customer_absent`, `other`). Mentre n'hi ha cap d'oberta, la fiança de la reserva no s'allibera. |

<!-- US-16 -->
<!-- US-04 -->

#### Valoracions de productes (US-04)

| Taula | Camps | Regles |
|---|---|---|
| `reviews` | `product_id`, `event_id`, `customer_id`, `rating`, `comment`, `hidden`, `hidden_at`, `hidden_by` | Valoració (1–5, comentari opcional de fins a 1.000 caràcters) d'un producte per part del client d'una reserva **finalitzada** que el contenia (ho comprova un trigger). Una per client, producte i reserva. Les ocultes per l'administrador no es mostren ni compten a la mitjana. |

<!-- fi de les zones -->


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

[`db/seeds/007_riders.sql`](db/seeds/007_riders.sql) afegeix 2 riders: `rider@example.com` (furgoneta) i
`rider2@example.com` (bicicleta de càrrega), amb la mateixa contrasenya de desenvolupament que la resta.
[`db/seeds/008_rider_services.sql`](db/seeds/008_rider_services.sql) assigna a `rider@example.com` 3 serveis
de la reserva del 15/06/2030 (una recollida amb la franja moguda després d'acceptar-la) i 1 d'una reserva
cancel·lada; la recollida de Mobiliario Turia del 17/06 queda pendent.
[`db/seeds/009_bookings_sprint2.sql`](db/seeds/009_bookings_sprint2.sql) deixa una reserva en cada estat que
necessiten les històries del Sprint 2, perquè cadascuna es pugui provar sola: 2 reserves finalitzades a
l'octubre de 2026 (lliurament i recollida fets), una reserva confirmada del 20/07/2030 amb els dos
lliuraments **en curs** i una recollida pendent, i una reserva del client **pendent de pagament** (08/08/2030).
Els serveis dels seeds tenen ids fixos (`d2…01`–`d2…15`), com els de [`tests/smoke/lib.sh`](tests/smoke/lib.sh).

<!-- Sprint 2: cada història afegeix aquí les seves dades d'exemple, dins de la seva zona. -->
<!-- US-04 -->
[`db/seeds/010_reviews.sql`](db/seeds/010_reviews.sql) afegeix 2 valoracions de l'altaveu a les reserves
finalitzades (5 i 4, mitjana 4,5); els micròfons de la reserva del client encara es poden valorar.

<!-- fi de les zones -->

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
| `api/authApi.test.js` | Peticions d'inici de sessió, `fetchMe` sense sessió (401 → `null`) i `logout` sense cos |
| `lib/catalog.test.js` · `lib/dates.test.js` · `lib/format.test.js` | Arbre i selecció de categories, conversió de dates i graella del calendari, format dels preus |
| `components/AvailabilityPicker.test.jsx` | Unitats lliures i preu de l'interval, dates proposades, error i calendari |
| `components/AddToCart.test.jsx` | Afegir a la cistella: sense sessió, sense dates i amb dates diferents de les de la cistella |
| `components/DeliveryForm.test.jsx` | Franges per codi postal i dia, franges plenes o incompatibles, fora de cobertura i desament |
| `components/PhotoUploader.test.jsx` | Formats i mida de les fotos, pujada, reintent d'una sola foto i esborrat |
| `pages/ProductDetail.test.jsx` | Fitxa amb els imports en format es-ES, especificacions, imatges que fallen, 404 i tornada al catàleg amb els filtres |
| `pages/LoginPage.test.jsx` · `pages/RegisterPage.test.jsx` · `pages/VerifyEmailPage.test.jsx` | Inici de sessió (destinació per rol, missatge genèric), registre (termes, contrasenya, venedor) i verificació del correu |
| `pages/BecomeSellerPage.test.jsx` · `pages/SellerProductForm.test.jsx` | Fer-se venedor i formulari del producte (desar, publicar i què falta) |
| `pages/CartPage.test.jsx` | Cistella per venedor, preu canviat, unitats insuficients, 409 i eliminar línies |

**Sprint 2.** Els tests dels fonaments, i després els de cada història.

| Fitxer | Què cobreix |
|---|---|
| `pages/BookingPage.test.jsx` | Pàgina d'una reserva: estat, número, resum amb els imports, reserva inexistent i error que es pot reintentar |
| `pages/BookingsPage.test.jsx` | «Mis reservas»: estat i enllaç al detall de cada reserva, llista buida i error |
| `pages/RiderServicePage.test.jsx` | Detall d'un servei del rider: adreça, client, instruccions, material, enllaç al mapa, servei cancel·lat i d'un altre rider |
| `components/TrackingTimeline.test.jsx` | Fases fetes i actual amb l'hora, venedors independents, retard, incidència i informació desactualitzada |
| `hooks/usePolling.test.js` | Consulta periòdica: interval, última dada bona quan falla una consulta i desactivació |
| `api/bookingApi.test.js` | Client de les reserves: rutes, mètodes i capçalera `Idempotency-Key` |
| `api/riderApi.test.js` | Client del rider: rutes, mètodes i fotos com a `FormData` |

<!-- Sprint 2: cada història afegeix aquí la seva taula, dins de la seva zona (vegeu CONTRIBUTING.md). -->
<!-- US-12 -->
<!-- US-08 -->

#### Pagament i fiança (US-08)

| Fitxer | Què cobreix |
|---|---|
| `components/BookingPayment.test.jsx` | Botó de pagar fins que caduca el bloqueig, consulta en tornar de la passarel·la fins que es confirma i estat del pagament que no es pot llegir |
| `components/PaymentPanel.test.jsx` | Total a cobrar i fiança a part, redirecció a la passarel·la sense cap camp de targeta, pagament rebutjat o cancel·lat, comprovant i estat de la fiança |
| `pages/MockPaymentPage.test.jsx` | Pàgina de pagament simulat: targetes de prova, errors i que mai redirigeix fora de l'app |

<!-- US-14 -->
<!-- US-15 -->

#### Llista de serveis del rider (US-15)

| Fitxer | Què cobreix |
|---|---|
| `pages/MyServicesPage.test.jsx` | Llista del rider per dia: estat, modificat, cancel·lat, canvi de dia, estat buit i petició avortada en sortir o canviar de dia |

<!-- US-09 -->
<!-- US-11 -->

#### Prova de lliurament i recollida (US-11)

| Fitxer | Què cobreix |
|---|---|
| `components/ProofForm.test.jsx` | Checklist del rider: fotos i estat obligatoris, explicació si el material no és correcte, reintent d'una foto, error sense perdre el formulari i incidència |
| `pages/ProofPage.test.jsx` | Prova d'un servei amb fotos i incidències, accés denegat, i llista de serveis del venedor |
| `components/ServiceProof.test.jsx` | Prova al detall del rider: checklist o incidència amb el servei en curs i enllaç a la prova quan s'ha acabat |

<!-- US-16 -->
<!-- US-04 -->
<!-- fi de les zones -->


Per crear productes de prova, feu servir `makeProduct()` i `makePage()` de
[`src/test/fixtures.js`](bloop4-frontend/src/test/fixtures.js).

### API

```powershell
cd api
npm test                                     # tests de rutes i mòduls (sense BD)
$env:DATABASE_URL = "postgres://eventrent:eventrent_dev@localhost:5432/eventrent"
npm test                                     # + els d'integració amb SQL real (BD amb els seeds)
```

Fan servir el runner de Node (`node --test`), sense dependències extra.

| Fitxer | Què cobreix |
|---|---|
| `test/catalog.test.js` | Rutes amb un repositori fals: paginació per defecte, `categoryId` múltiple i sense duplicats, validació (UUID, `page`, `pageSize`), errors 400/404/500 sense detalls interns i `/api/health` |
| `test/catalogRepository.integration.test.js` | SQL real contra la BD amb els seeds: recomptes de categories, filtre jeràrquic (un pare inclou les filles), paginació sense repetir ni saltar productes i forma del JSON. S'omet si no hi ha `DATABASE_URL` |
| `test/auth.test.js` · `test/authModules.test.js` | Registre, inici i tancament de sessió, rols que no es poden triar, límit d'intents (429), hash `scrypt`, cookies i tokens |
| `test/authRepository.integration.test.js` | Usuaris, rols, venedors, verificació del correu, sessions i intents fallits contra PostgreSQL |
| `test/seller.test.js` · `test/sellerRepository.integration.test.js` · `test/images.test.js` | Productes del venedor (esborrany, edició, publicació i què falta), unitats, límit de 10 fotos i tipus d'imatge pel contingut |
| `test/availability.test.js` · `test/availabilityRepository.integration.test.js` | Disponibilitat i calendari: validació de dates, marge de preparació, `[inici, fi)`, unitats en manteniment, dies facturables i rendiment |
| `test/cart.test.js` · `test/cartRepository.integration.test.js` | Cistella: accés per rol, dates, línies, 409 per manca d'unitats, avisos de preu i disponibilitat, totals a SQL i caducitat |
| `test/delivery.test.js` · `test/deliveryRepository.integration.test.js` | Franges, cobertura per codi postal, antelació de 24 h, vehicle pel pes i el volum i preu del transport |
| `test/mailer.test.js` | Enviament per SMTP amb usuari i contrasenya (Gmail) i sense (Mailpit) |

**Sprint 2.** Els tests dels fonaments, i després els de cada història.

| Fitxer | Què cobreix |
|---|---|
| `test/hooks.test.js` | Punts d'extensió entre històries: ordre dels gestors, sense gestors i errors |
| `test/bookingAccess.test.js` | Reserva del client per a les rutes `/api/bookings/:id/…`: 400, 404, 403 i avís abans de llegir-la |
| `test/bookings.test.js` | `GET /api/bookings[/:id]`: només el client, sense `customerId`, imports congelats i autorització |
| `test/bookingRepository.integration.test.js` | Lectura i confirmació de reserves contra PostgreSQL (venedors a avisar, només una vegada) |
| `test/riderAccess.test.js` | Rol `rider` amb vehicle davant de totes les rutes `/api/rider` i `parseServiceId` |
| `test/riderRepository.integration.test.js` | Perfil del rider i detall d'un servei seu contra PostgreSQL: dades del client, línies, servei modificat i servei d'un altre rider |
| `test/notificationRepository.integration.test.js` | Avisos contra PostgreSQL: ordre, no llegits i que cada usuari només marca els seus |

<!-- Sprint 2: cada història afegeix aquí la seva taula, dins de la seva zona (vegeu CONTRIBUTING.md). -->
<!-- US-12 -->
<!-- US-08 -->

#### Pagament i fiança (US-08)

| Fitxer | Què cobreix |
|---|---|
| `test/paymentGateways.test.js` | Passarel·la simulada i adaptador de Stripe (amb un client fals però la verificació de signatura real de la llibreria): sessió de Checkout, traducció d'esdeveniments, signatures invàlides i retenció de la fiança amb captura manual |
| `test/payments.test.js` | Rutes de pagament: autorització, webhook sense sessió i amb signatura obligatòria, i pàgina de pagament simulat (que no existeix amb `PAYMENT_PROVIDER=stripe`) |
| `test/payments.integration.test.js` | Pagament de punta a punta contra PostgreSQL: import calculat al servidor, un sol pagament en curs, confirmació, comprovant, avisos repetits, targeta rebutjada, devolució si el bloqueig ha caducat i fiança (programada, retinguda, fallida i alliberada) |
| `test/bookingService.test.js` | Confirmació de la reserva pagada i avís `bookingConfirmed` |

<!-- US-14 -->
<!-- US-15 -->

#### Llista de serveis del rider (US-15)

| Fitxer | Què cobreix |
|---|---|
| `test/riderSchedule.test.js` | Llista d'un dia i propers serveis; autorització (401 sense sessió, 403 amb un altre rol o sense vehicle) i valors límit de la data (dies que no existeixen, com el 31/02, responen 400) |
| `test/riderSchedule.integration.test.js` | Llista del rider contra PostgreSQL: dia en hora de Madrid, ordre, serveis modificats o cancel·lats, propers serveis i que un rider no veu els d'un altre |

<!-- US-09 -->
<!-- US-11 -->

#### Prova de lliurament i recollida (US-11)

| Fitxer | Què cobreix |
|---|---|
| `test/proofs.test.js` | Rutes de les proves: pujada de fotos (tipus comprovat pel contingut), accés privat a les fotos, checklist, incidències i administració |
| `test/proofs.integration.test.js` | Proves contra PostgreSQL i un directori temporal: servei no iniciat, fotos i checklist obligatoris, qui pot veure la prova, foto d'una altra línia, tancament de la reserva, fiança retinguda fins que es resol la incidència i client absent |

<!-- US-16 -->
<!-- US-04 -->
<!-- fi de les zones -->


Els tests d'integració s'ometen si no hi ha `DATABASE_URL`.

### Base de dades

Proves d'integritat de l'esquema (un fitxer per migració a [`db/tests/integrity/`](db/tests/integrity/))
sobre la base de dades de Docker Compose, amb els seeds carregats. S'executen dins d'una
transacció que acaba en `ROLLBACK`: no modifiquen les dades.

```bash
./db/test.sh   # des de Git Bash
```

Ha d'acabar amb `Totes les proves han passat.` Hi ha un bloc per a cada migració: recomptes dels seeds,
claus, `CHECK`, triggers i restriccions (per exemple, que no es poden esborrar categories ni
venedors amb productes o que una unitat no pot tenir dues reserves que se solapin). Cada migració
nova hi afegeix les seves proves.

### CI

A cada PR cap a `dev` o `main`, el job **API + BD** de GitHub Actions aplica totes les migracions i
els seeds, executa les proves d'integritat, els tests de l'API amb `DATABASE_URL` i les consultes
d'exemple, i arrenca l'API per fer un *smoke test* del contracte amb les dades d'exemple (un script
per al Sprint 1 i un per història a [`tests/smoke/`](tests/smoke/), independents entre ells). El job
**Frontend** passa els tests i el build. Vegeu [CONTRIBUTING.md](CONTRIBUTING.md#integració-contínua-ci).
