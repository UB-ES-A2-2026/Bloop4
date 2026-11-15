// Passa els tests amb cobertura i comprova els llindars de tests/quality-gates.mjs.
// Ús (des de tests/):
//   npm run coverage:api        (amb DATABASE_URL; sense, s'ometen els tests d'integració i el llindar no es comprova)
//   npm run coverage:frontend
// Deixa l'informe HTML/LCOV a <paquet>/coverage/ i el resum a tests/reports/coverage-<paquet>.json.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { coverageThresholds } from '../quality-gates.mjs';
import { ROOT, annotate, pct, repoPath, stepSummary, writeReport } from './lib/ci.mjs';

const METRICS = ['lines', 'branches', 'functions'];
const LABELS = { lines: 'Línies', branches: 'Branques', functions: 'Funcions' };
const TITLES = { api: 'API', frontend: 'Frontend' };

const target = process.argv[2];
if (!(target in coverageThresholds)) {
  console.error('Ús: node scripts/coverage.mjs api|frontend');
  process.exit(2);
}

const run = (command, args, cwd) =>
  spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm' }).status ?? 1;

const { status, files, enforce, note, tests } = target === 'api' ? coverApi() : coverFrontend();
const total = totals(files);
const thresholds = coverageThresholds[target];
const failing = enforce ? METRICS.filter((m) => total[m].pct < thresholds[m]) : [];

writeReport(`coverage-${target}`, { target, thresholds, enforced: enforce, total, files, tests, testsPassed: status === 0 });
summarize();

if (status !== 0) console.error(`\n✗ Han fallat tests de ${TITLES[target]}.`);
for (const m of failing) {
  const message = `Cobertura de ${LABELS[m].toLowerCase()} de ${TITLES[target]}: ${pct(total[m].pct)}, per sota del llindar de ${thresholds[m]} %`;
  console.error(`✗ ${message}`);
  annotate('error', { file: 'tests/quality-gates.mjs', title: 'Cobertura', message });
}
process.exitCode = status !== 0 || failing.length ? 1 : 0;

/** API: node:test amb la cobertura nativa de Node, exportada en LCOV. */
function coverApi() {
  const dir = join(ROOT, 'api');
  mkdirSync(join(dir, 'coverage'), { recursive: true });
  const withDb = Boolean(process.env.DATABASE_URL);
  if (!withDb) console.warn('⚠ Sense DATABASE_URL s\'ometen els tests d\'integració: es mostra la cobertura, però no es comprova el llindar.\n');
  const status = run(
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      '--experimental-test-coverage',
      '--test-coverage-include=src/**',
      '--test-reporter=spec',
      '--test-reporter-destination=stdout',
      '--test-reporter=lcov',
      '--test-reporter-destination=coverage/lcov.info',
      '--test-reporter=junit',
      '--test-reporter-destination=coverage/junit.xml',
    ],
    dir,
  );
  const lcov = join(dir, 'coverage', 'lcov.info');
  const files = existsSync(lcov) ? parseLcov(readFileSync(lcov, 'utf8'), dir) : [];
  // Node només compta els fitxers que algun test carrega: la resta (p. ex. server.js) hi entren al 0 %.
  const seen = new Set(files.map((f) => f.file));
  for (const abs of walk(join(dir, 'src'))) {
    const file = repoPath(abs);
    if (seen.has(file)) continue;
    const text = readFileSync(abs, 'utf8');
    const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    files.push({ file, lines: { total: lines, covered: 0 }, branches: { total: 0, covered: 0 }, functions: { total: 0, covered: 0 } });
  }
  return { status, files, enforce: withDb, note: withDb ? null : 'sense base de dades: llindar no comprovat', tests: countJunit(join(dir, 'coverage', 'junit.xml')) };
}

/** Frontend: Vitest amb el proveïdor v8. */
function coverFrontend() {
  const dir = join(ROOT, 'bloop4-frontend');
  // @vitest/coverage-v8 encara no és al package.json del frontend (els pegats del Sprint 2 el modifiquen):
  // s'instal·la sense desar-lo, amb la mateixa versió que Vitest. Vegeu tests/README.md.
  if (!existsSync(join(dir, 'node_modules', '@vitest', 'coverage-v8'))) {
    const version = JSON.parse(readFileSync(join(dir, 'node_modules', 'vitest', 'package.json'), 'utf8')).version;
    console.log(`S'instal·la @vitest/coverage-v8@${version} sense desar-lo al package.json...`);
    if (run('npm', ['install', '--no-save', '--no-audit', '--no-fund', `@vitest/coverage-v8@${version}`], dir) !== 0) process.exit(1);
  }
  const status = run(
    process.execPath,
    [
      join(dir, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      '--coverage.enabled',
      '--coverage.provider=v8',
      '--coverage.include=src/**',
      '--coverage.exclude=src/**/*.test.*',
      '--coverage.exclude=src/test/**',
      '--coverage.reporter=text-summary',
      '--coverage.reporter=json-summary',
      '--coverage.reporter=lcov',
      '--coverage.reporter=html',
      '--coverage.reportsDirectory=coverage',
      '--reporter=default',
      '--reporter=json',
      '--outputFile.json=coverage/vitest-results.json',
    ],
    dir,
  );
  const summaryFile = join(dir, 'coverage', 'coverage-summary.json');
  const summary = existsSync(summaryFile) ? JSON.parse(readFileSync(summaryFile, 'utf8')) : {};
  const files = Object.entries(summary)
    .filter(([key]) => key !== 'total')
    .map(([abs, m]) => ({
      file: repoPath(abs),
      ...Object.fromEntries(METRICS.map((k) => [k, { total: m[k].total, covered: m[k].covered }])),
    }));
  const resultsFile = join(dir, 'coverage', 'vitest-results.json');
  const r = existsSync(resultsFile) ? JSON.parse(readFileSync(resultsFile, 'utf8')) : null;
  const tests = r && { total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests + r.numTodoTests };
  return { status, files, enforce: true, note: null, tests };
}

/** Recompte de tests de l'informe JUnit de node:test (null si no s'ha generat). */
function countJunit(file) {
  if (!existsSync(file)) return null;
  const xml = readFileSync(file, 'utf8');
  const cases = xml.split('<testcase').slice(1);
  // Cada tros va del <testcase> fins al següent: els fills <failure> o <skipped> hi són a dins.
  const failed = cases.filter((c) => c.includes('<failure')).length;
  const skipped = cases.filter((c) => c.includes('<skipped')).length;
  return { total: cases.length, passed: cases.length - failed - skipped, failed, skipped };
}

/** Suma els fitxers i calcula el percentatge de cada mètrica (100 % si no n'hi ha cap). */
function totals(list) {
  return Object.fromEntries(
    METRICS.map((m) => {
      const t = list.reduce((acc, f) => acc + f[m].total, 0);
      const c = list.reduce((acc, f) => acc + f[m].covered, 0);
      return [m, { total: t, covered: c, pct: t ? (100 * c) / t : 100 }];
    }),
  );
}

function parseLcov(text, cwd) {
  return text
    .split('end_of_record')
    .map((record) => {
      const value = (key) => Number(record.match(new RegExp(`^${key}:(\\d+)`, 'm'))?.[1] ?? 0);
      const source = record.match(/^SF:(.+)$/m)?.[1];
      if (!source) return null;
      return {
        file: repoPath(resolve(cwd, source.trim())),
        lines: { total: value('LF'), covered: value('LH') },
        branches: { total: value('BRF'), covered: value('BRH') },
        functions: { total: value('FNF'), covered: value('FNH') },
      };
    })
    .filter(Boolean);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : [],
  );
}

function summarize() {
  const ok = status === 0 && failing.length === 0;
  const rows = METRICS.map((m) => {
    const state = !enforce ? '—' : total[m].pct >= thresholds[m] ? '✅' : '❌';
    return `| ${LABELS[m]} | ${pct(total[m].pct)} | ${total[m].covered} / ${total[m].total} | ${thresholds[m]} % | ${state} |`;
  });
  const lowest = files
    .filter((f) => f.lines.total > 0)
    .map((f) => ({ ...f, p: (100 * f.lines.covered) / f.lines.total }))
    .filter((f) => f.p < thresholds.lines)
    .sort((a, b) => a.p - b.p)
    .slice(0, 10)
    .map((f) => `| \`${f.file}\` | ${pct(f.p)} |`);
  const md = [
    `### ${ok ? '✅' : '❌'} Cobertura · ${TITLES[target]}${note ? ` (${note})` : ''}`,
    '',
    '| Mètrica | Cobertura | Cobert / total | Llindar | |',
    '|---|---:|---:|---:|:---:|',
    ...rows,
    ...(lowest.length
      ? ['', `<details><summary>Fitxers per sota del ${thresholds.lines} % de línies (${lowest.length})</summary>`, '', '| Fitxer | Línies |', '|---|---:|', ...lowest, '', '</details>']
      : []),
  ].join('\n');
  stepSummary(md);
  console.log(`\nCobertura ${TITLES[target]}: ${METRICS.map((m) => `${LABELS[m].toLowerCase()} ${pct(total[m].pct)}`).join(' · ')}`);
}
