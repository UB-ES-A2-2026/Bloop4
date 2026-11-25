// `npm audit` de l'API i del frontend. Només llegeix els package-lock.json (no cal `npm ci`).
// Ús (des de tests/): npm run audit                  dependències de producció, informatiu
//                     npm run audit -- --include-dev  també les de desenvolupament
//                     npm run audit -- --strict       falla si n'hi ha cap d'alta o crítica
// Als PR, la porta és la revisió de dependències (només les vulnerabilitats noves); això és l'informe.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, stepSummary, writeReport } from './lib/ci.mjs';

const PACKAGES = ['api', 'bloop4-frontend'];
const SEVERITIES = ['critical', 'high', 'moderate', 'low'];
const LABELS = { critical: 'crítica', high: 'alta', moderate: 'moderada', low: 'baixa' };
const includeDev = process.argv.includes('--include-dev');
const strict = process.argv.includes('--strict');

const report = {};
for (const pkg of PACKAGES) {
  const args = ['audit', '--json', ...(includeDev ? [] : ['--omit=dev'])];
  const result = spawnSync('npm', args, { cwd: join(ROOT, pkg), encoding: 'utf8', shell: process.platform === 'win32' });
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    console.error(`No s'ha pogut llegir el resultat de npm audit a ${pkg}/:\n${result.stderr}`);
    process.exit(1);
  }
  const vulnerabilities = Object.values(json.vulnerabilities ?? {}).map((v) => ({
    name: v.name,
    severity: v.severity,
    direct: v.isDirect,
    fixAvailable: Boolean(v.fixAvailable),
    advisories: v.via.filter((via) => typeof via === 'object').map((via) => ({ title: via.title, url: via.url })),
  }));
  report[pkg] = { counts: json.metadata?.vulnerabilities ?? {}, vulnerabilities };
}

writeReport('audit', { includeDev, packages: report });

const serious = PACKAGES.flatMap((pkg) => report[pkg].vulnerabilities.filter((v) => ['critical', 'high'].includes(v.severity)).map((v) => ({ pkg, ...v })));
const lines = [
  `### ${serious.length ? '⚠️' : '✅'} Dependències (npm audit${includeDev ? ', amb les de desenvolupament' : ', només producció'})`,
  '',
  '| Paquet | Crítiques | Altes | Moderades | Baixes |',
  '|---|---:|---:|---:|---:|',
  ...PACKAGES.map((pkg) => `| \`${pkg}\` | ${SEVERITIES.map((s) => report[pkg].counts[s] ?? 0).join(' | ')} |`),
];
if (serious.length) {
  lines.push('', '| Dependència | On | Gravetat | Solució automàtica | Avís |', '|---|---|---|---|---|');
  for (const v of serious) {
    const advisory = v.advisories[0];
    lines.push(`| \`${v.name}\` | \`${v.pkg}\` | ${LABELS[v.severity]} | ${v.fixAvailable ? 'sí' : 'no'} | ${advisory ? `[${advisory.title}](${advisory.url})` : 'vegeu les dependències que la inclouen'} |`);
  }
}
stepSummary(lines.join('\n'));

for (const pkg of PACKAGES) {
  const c = report[pkg].counts;
  console.log(`${pkg}: ${SEVERITIES.map((s) => `${c[s] ?? 0} ${LABELS[s]}`).join(', ')}`);
}
for (const v of serious) console.log(`  ⚠ ${v.pkg}: ${v.name} (${LABELS[v.severity]})${v.advisories[0] ? ` · ${v.advisories[0].title}` : ''}`);
process.exitCode = strict && serious.length ? 1 : 0;
