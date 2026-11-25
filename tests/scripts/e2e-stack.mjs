// Stack de Docker Compose només per a les proves E2E: projecte, volums i ports propis, perquè
// les proves (que creen comptes, cistelles i productes) no toquin la base de dades de desenvolupament.
// Ús (des de tests/): npm run e2e:up · npm run e2e:down · npm run e2e:logs
import { spawnSync } from 'node:child_process';
import { E2E_PORTS, E2E_PROJECT, BASE_URL } from '../e2e/support/env.mjs';
import { ROOT } from './lib/ci.mjs';

const ACTIONS = {
  // --wait: torna quan la base de dades i l'API estan sanes i la resta, en marxa.
  up: ['up', '-d', '--build', '--wait', '--wait-timeout', '300'],
  // -v: esborra també els volums; cada `up` comença amb els seeds nets.
  down: ['down', '-v', '--remove-orphans'],
  logs: ['logs', '--no-color', '--tail', '200'],
};

const action = process.argv[2];
if (!(action in ACTIONS)) {
  console.error(`Ús: node scripts/e2e-stack.mjs ${Object.keys(ACTIONS).join('|')}`);
  process.exit(2);
}

const env = {
  ...process.env,
  FRONTEND_PORT: String(E2E_PORTS.frontend),
  API_PORT: String(E2E_PORTS.api),
  MAILPIT_PORT: String(E2E_PORTS.mailpit),
  POSTGRES_PORT: String(E2E_PORTS.db),
  // Els enllaços dels correus (verificació) han d'apuntar al frontend d'aquest stack.
  APP_URL: BASE_URL,
  COOKIE_SECURE: 'false',
};

const { status } = spawnSync('docker', ['compose', '-p', E2E_PROJECT, ...ACTIONS[action]], { cwd: ROOT, env, stdio: 'inherit' });
if (status === 0 && action === 'up') console.log(`\nStack E2E a punt: ${BASE_URL} (correus a http://localhost:${E2E_PORTS.mailpit})`);
process.exitCode = status ?? 1;
