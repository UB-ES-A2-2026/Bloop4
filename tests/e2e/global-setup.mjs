// Abans de començar: comprova que el stack de proves respon (i, si no, diu com aixecar-lo) i
// n'esborra els intents d'inici de sessió. Totes les proves arriben a l'API des de la mateixa IP i
// l'API la bloqueja 15 minuts després de 5 intents fallits; sense això, repetir les proves en
// local acabaria bloquejant tots els inicis de sessió.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPORTS_DIR, ROOT } from '../scripts/lib/ci.mjs';
import { BASE_URL, E2E_PROJECT, MAILPIT_URL } from './support/env.mjs';

export default async function globalSetup() {
  for (const [what, url] of [
    ['l\'aplicació', `${BASE_URL}/api/health`],
    ['Mailpit', `${MAILPIT_URL}/api/v1/info`],
  ]) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      throw new Error(`No es pot arribar a ${what} (${url}): ${err.message}.\nAixeca el stack de proves amb \`npm run e2e:up\` (a tests/).`);
    }
  }

  // Els resultats d'accessibilitat d'execucions anteriors no han de sortir a l'informe d'aquesta.
  rmSync(join(REPORTS_DIR, 'a11y'), { recursive: true, force: true });

  // Només al stack propi de les proves; mai a un altre entorn (E2E_BASE_URL).
  if (process.env.E2E_BASE_URL) return;
  const sql = 'DELETE FROM login_attempts';
  const { status, stderr } = spawnSync(
    'docker',
    ['compose', '-p', E2E_PROJECT, 'exec', '-T', 'db', 'sh', '-c', `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c "${sql}"`],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (status !== 0) console.warn(`⚠ No s'han pogut esborrar els intents d'inici de sessió del stack de proves: ${stderr.trim()}`);
}
