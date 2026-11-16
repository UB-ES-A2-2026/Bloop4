// Proves de mutació amb Stryker (tests/stryker/*.json) i resum a tests/reports/mutation.json.
// Ús (des de tests/): npm run mutation            API (sense BD) i frontend
//                     DATABASE_URL=… npm run mutation   també els mòduls de l'API que només es proven amb BD
//                     npm run mutation -- frontend      només un paquet (api o frontend)
// És informatiu: no falla per la puntuació. S'executa cada nit (workflow «Nocturn»).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, REPORTS_DIR, pct, stepSummary, writeReport } from './lib/ci.mjs';

// Stryker encara no és a les dependències de l'API ni del frontend (els pegats del Sprint 2 en
// modifiquen el package.json): s'instal·la sense desar-lo, sempre amb aquesta versió.
const STRYKER_VERSION = '9.6.1';
const RUNS = [
  { id: 'api-unit', target: 'api', dir: 'api', runner: 'tap-runner', env: { DATABASE_URL: '' } },
  { id: 'api-db', target: 'api', dir: 'api', runner: 'tap-runner', needsDb: true },
  { id: 'frontend', target: 'frontend', dir: 'bloop4-frontend', runner: 'vitest-runner' },
];
// Els errors de compilació o d'execució i els mutants ignorats no compten a la puntuació.
const DETECTED = ['Killed', 'Timeout'];

const only = process.argv[2];
const outDir = join(REPORTS_DIR, 'mutation');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const shell = process.platform === 'win32';
const failures = [];
for (const run of RUNS.filter((r) => !only || r.target === only)) {
  if (run.needsDb && !process.env.DATABASE_URL) {
    console.warn(`⚠ ${run.id}: sense DATABASE_URL, s'omet.`);
    continue;
  }
  const cwd = join(ROOT, run.dir);
  const core = join(cwd, 'node_modules', '@stryker-mutator', 'core');
  const installed = existsSync(core) && JSON.parse(readFileSync(join(core, 'package.json'), 'utf8')).version === STRYKER_VERSION;
  if (!installed) {
    const pkgs = [`@stryker-mutator/core@${STRYKER_VERSION}`, `@stryker-mutator/${run.runner}@${STRYKER_VERSION}`];
    console.log(`S'instal·la Stryker a ${run.dir}/ sense desar-lo al package.json...`);
    spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', ...pkgs], { cwd, stdio: 'inherit', shell });
  }
  console.log(`\n▶ Stryker: ${run.id}`);
  const env = { ...process.env, ...run.env };
  if (env.DATABASE_URL === '') delete env.DATABASE_URL;
  const { status } = spawnSync(process.execPath, [join(core, 'bin', 'stryker.js'), 'run', join(ROOT, 'tests', 'stryker', `${run.id}.json`)], { cwd, env, stdio: 'inherit' });
  if (status !== 0) failures.push(run.id);
}

// Resum per paquet: l'API ajunta les dues execucions (mutaven fitxers diferents).
const summary = { generatedAt: new Date().toISOString(), excludedMutations: ['StringLiteral'] };
for (const target of ['api', 'frontend']) {
  const files = {};
  for (const run of RUNS.filter((r) => r.target === target)) {
    const file = join(outDir, `${run.id}.json`);
    if (existsSync(file)) Object.assign(files, JSON.parse(readFileSync(file, 'utf8')).files);
  }
  if (Object.keys(files).length) summary[target] = score(files);
}
writeReport('mutation', summary);

const rows = ['api', 'frontend']
  .filter((t) => summary[t])
  .map((t) => {
    const s = summary[t];
    return `| ${t} | ${pct(s.score)} | ${pct(s.coveredScore)} | ${s.killed} | ${s.survived} | ${s.noCoverage} | ${s.total} |`;
  });
const weakest = ['api', 'frontend']
  .flatMap((t) => (summary[t]?.files ?? []).map((f) => ({ ...f, target: t })))
  .filter((f) => f.total >= 5)
  .sort((a, b) => a.coveredScore - b.coveredScore)
  .slice(0, 10)
  .map((f) => `| \`${f.file}\` | ${pct(f.coveredScore)} | ${f.survived} |`);
stepSummary(
  [
    '### Proves de mutació (Stryker)',
    '',
    'Mutants morts: els canvis al codi que algun test detecta. «Sobre el codi cobert» descompta els mutants de línies que cap test executa.',
    '',
    '| Paquet | Total | Sobre el codi cobert | Morts | Sobreviuen | Sense cobrir | Mutants |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...rows,
    '',
    '<details><summary>Fitxers amb menys mutants morts</summary>',
    '',
    '| Fitxer | Sobre el codi cobert | Sobreviuen |',
    '|---|---:|---:|',
    ...weakest,
    '',
    '</details>',
  ].join('\n'),
);
for (const t of ['api', 'frontend']) if (summary[t]) console.log(`Mutació ${t}: ${pct(summary[t].score)} (${pct(summary[t].coveredScore)} sobre el codi cobert)`);
if (failures.length) console.error(`✗ Stryker ha fallat a: ${failures.join(', ')}`);
process.exitCode = failures.length ? 1 : 0;

/** Puntuació a partir de l'informe de Stryker (format mutation-testing-report-schema). */
function score(files) {
  const count = (mutants, statuses) => mutants.filter((m) => statuses.includes(m.status)).length;
  const perFile = Object.entries(files).map(([file, { mutants }]) => {
    const detected = count(mutants, DETECTED);
    const survived = count(mutants, ['Survived']);
    const noCoverage = count(mutants, ['NoCoverage']);
    const valid = detected + survived + noCoverage;
    return {
      file: file.replace(/\\/g, '/'),
      killed: detected,
      survived,
      noCoverage,
      total: valid,
      score: valid ? (100 * detected) / valid : 100,
      coveredScore: detected + survived ? (100 * detected) / (detected + survived) : 100,
    };
  });
  const sum = (key) => perFile.reduce((acc, f) => acc + f[key], 0);
  const killed = sum('killed');
  const survived = sum('survived');
  const noCoverage = sum('noCoverage');
  const total = killed + survived + noCoverage;
  return {
    score: total ? (100 * killed) / total : 100,
    coveredScore: killed + survived ? (100 * killed) / (killed + survived) : 100,
    killed,
    survived,
    noCoverage,
    total,
    files: perFile,
  };
}
