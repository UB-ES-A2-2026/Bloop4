// Passa Lighthouse CI (tests/lighthouserc.cjs) amb el Chromium de Playwright i en resumeix el
// resultat. Ús (des de tests/, amb el stack de proves aixecat): npm run lighthouse
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT, stepSummary, writeReport } from './lib/ci.mjs';

const TESTS = join(ROOT, 'tests');
const OUTPUT = join(TESTS, 'reports', 'lighthouse');
const CATEGORIES = { performance: 'Rendiment', accessibility: 'Accessibilitat', 'best-practices': 'Bones pràctiques', seo: 'SEO' };

rmSync(OUTPUT, { recursive: true, force: true });
rmSync(join(TESTS, '.lighthouseci'), { recursive: true, force: true });
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? chromium.executablePath() };
const lhci = join(TESTS, 'node_modules', '@lhci', 'cli', 'src', 'cli.js');
const { status } = spawnSync(process.execPath, [lhci, 'autorun', '--config=./lighthouserc.cjs'], { cwd: TESTS, env, stdio: 'inherit' });

const manifestFile = join(OUTPUT, 'manifest.json');
if (!existsSync(manifestFile)) {
  console.error('Lighthouse no ha generat cap informe.');
  process.exit(status || 1);
}
// Una entrada per passada; ens quedem amb la representativa (la mediana) de cada URL.
const pages = JSON.parse(readFileSync(manifestFile, 'utf8'))
  .filter((run) => run.isRepresentativeRun)
  .map((run) => ({
    url: new URL(run.url).pathname,
    scores: Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, Math.round(run.summary[c] * 100)])),
    report: run.htmlPath ? `tests/reports/lighthouse/${run.htmlPath.split(/[\\/]/).pop()}` : null,
  }));
writeReport('lighthouse', { pages, passed: status === 0 });

const header = `| Pantalla | ${Object.values(CATEGORIES).join(' | ')} |`;
stepSummary(
  [
    `### ${status === 0 ? '✅' : '❌'} Lighthouse (escriptori, mediana de 3 passades)`,
    '',
    header,
    `|---|${Object.keys(CATEGORIES).map(() => '---:').join('|')}|`,
    ...pages.map((p) => `| \`${p.url}\` | ${Object.keys(CATEGORIES).map((c) => p.scores[c]).join(' | ')} |`),
    '',
    'Només l\'accessibilitat per sota de 90 fa fallar; la resta són avisos.',
  ].join('\n'),
);
for (const p of pages) console.log(`${p.url}: ${Object.entries(p.scores).map(([c, s]) => `${CATEGORIES[c]} ${s}`).join(' · ')}`);
process.exitCode = status ?? 1;
