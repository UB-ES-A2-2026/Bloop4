// Utilitats compartides pels scripts de QA: camins, informes JSON i sortida per a GitHub Actions.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Arrel del repositori (els scripts són a tests/scripts/). */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const REPORTS_DIR = join(ROOT, 'tests', 'reports');

export const inGitHubActions = process.env.GITHUB_ACTIONS === 'true';

/** Camí relatiu a l'arrel amb barres normals, com el mostra GitHub. */
export const repoPath = (absolute) => relative(ROOT, absolute).split(sep).join('/');

/** Desa un informe a tests/reports/<nom>.json (el llegeix l'informe de QA del PR). */
export function writeReport(name, data) {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const file = join(REPORTS_DIR, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

/** Afegeix markdown al resum del job (pestanya Summary de l'execució). Fora de la CI, no fa res. */
export function stepSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}

/** Anotació de GitHub Actions: surt al costat de la línia al diff del PR. */
export function annotate(level, { file, line, col, title, message }) {
  if (!inGitHubActions) return;
  const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const props = [`file=${file}`, line && `line=${line}`, col && `col=${col}`, title && `title=${esc(title).replace(/[,:]/g, ' ')}`]
    .filter(Boolean)
    .join(',');
  console.log(`::${level} ${props}::${esc(message)}`);
}

/** 96.4912 → "96,5 %" */
export const pct = (n) => (n == null ? '—' : `${n.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`);
