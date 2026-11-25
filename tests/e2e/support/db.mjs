// SQL contra la base de dades del stack de proves (`npm run e2e:up`), per preparar l'estat que
// necessita cada prova sense passar per les pantalles d'altres històries. Contra un altre entorn
// (E2E_BASE_URL) no hi ha accés a la base de dades: les proves que en depenen s'ometen.
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../scripts/lib/ci.mjs';
import { E2E_PROJECT } from './env.mjs';

export const canUseDatabase = !process.env.E2E_BASE_URL;

/** Executa `query` (una o diverses sentències) i retorna les files de l'última com a llistes de text. */
export function sql(query) {
  if (!canUseDatabase) throw new Error('Sense accés a la base de dades: només amb el stack de proves');
  const { status, stdout, stderr } = spawnSync(
    'docker',
    ['compose', '-p', E2E_PROJECT, 'exec', '-T', 'db', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -q -At -F "|" -v ON_ERROR_STOP=1'],
    { cwd: ROOT, input: query, encoding: 'utf8' },
  );
  if (status !== 0) throw new Error(`Error de SQL: ${stderr.trim()}\n${query}`);
  return stdout.trim().split('\n').filter(Boolean).map((line) => line.split('|'));
}

/** Escapa un valor de text per posar-lo dins d'una sentència. */
export const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
