// On són el frontend i Mailpit del stack de proves. Per defecte, el que aixeca `npm run e2e:up`;
// amb E2E_BASE_URL i E2E_MAILPIT_URL es pot apuntar a un altre (per exemple, el de `docker compose up`).
export const E2E_PROJECT = 'bloop4-e2e';
export const E2E_PORTS = { frontend: 8180, api: 3100, mailpit: 8125, db: 5532 };

export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORTS.frontend}`;
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? `http://localhost:${E2E_PORTS.mailpit}`;

/** Contrasenya dels comptes dels seeds (és al repositori; només per a desenvolupament i proves). */
export const SEED_PASSWORD = 'Bloop4-dev-2026';
