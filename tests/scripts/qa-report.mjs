// Informe de QA d'una execució: el comentari del PR (markdown) i el resum en JSON per al tauler.
// Ús: node scripts/qa-report.mjs [--artifacts <carpeta>] [--baseline <url o fitxer>]
//   --artifacts  on són els informes (per defecte, tests/reports; a la CI, els artefactes descarregats)
//   --baseline   resum de dev per comparar-hi (a la CI, data/latest.json del tauler de QA)
// Escriu tests/reports/qa-report.md i tests/reports/qa-summary.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { COVERAGE_METRICS, LIGHTHOUSE_CATEGORIES, LIGHTHOUSE_MIN, collectMetrics } from './lib/metrics.mjs';
import { REPORTS_DIR, pct, stepSummary, writeReport } from './lib/ci.mjs';

export const MARKER = '<!-- bloop4-qa-report -->';
const { values: args } = parseArgs({ options: { artifacts: { type: 'string' }, baseline: { type: 'string' } } });

const metrics = collectMetrics(args.artifacts ?? REPORTS_DIR);
const baseline = await loadBaseline(args.baseline);
const env = process.env;
const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null;
const sha = env.QA_SHA ?? env.GITHUB_SHA ?? null;

const summary = {
  meta: { generatedAt: new Date().toISOString(), sha, ref: env.QA_REF ?? env.GITHUB_REF_NAME ?? null, runUrl },
  ...metrics,
};
writeReport('qa-summary', summary);

const LABELS = { lines: 'línies', branches: 'branques', functions: 'funcions' };
const LH_LABELS = { performance: 'rendiment', accessibility: 'accessibilitat', 'best-practices': 'bones pràctiques', seo: 'SEO' };
const ICON = { ok: '✅', warn: '⚠️', fail: '❌', none: '⏭️', info: 'ℹ️' };
const num = (n) => n.toLocaleString('ca-ES', { maximumFractionDigits: 1 });
/** Diferència amb dev: «+0,3», «−2», «=». */
function delta(now, before, unit = '') {
  if (now == null || before == null) return '';
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return '=';
  return `${d > 0 ? '+' : '−'}${num(Math.abs(d))}${unit}`;
}

const rows = [];
const details = [];

// Lint
if (metrics.lint) {
  const { errors, warnings } = metrics.lint;
  rows.push(['Lint', errors ? 'fail' : 'ok', `${errors} errors · ${warnings} avisos`, delta(warnings, baseline?.lint?.warnings) && `avisos ${delta(warnings, baseline?.lint?.warnings)}`]);
  const rules = Object.entries(metrics.lint.byRule).sort(([, a], [, b]) => b.errors - a.errors || b.warnings - a.warnings);
  if (rules.length) details.push(['Lint per regla', ['| Regla | Errors | Avisos |', '|---|---:|---:|', ...rules.map(([r, n]) => `| \`${r}\` | ${n.errors} | ${n.warnings} |`)]]);
} else rows.push(['Lint', 'none', 'no s\'ha executat', '']);

// Tests i cobertura de l'API i del frontend
for (const [target, title, of] of [['api', 'API', 'de l\'API'], ['frontend', 'Frontend', 'del frontend']]) {
  const c = metrics.coverage?.[target];
  if (!c) {
    rows.push([`Tests ${title}`, 'none', 'no s\'han executat', '']);
    continue;
  }
  const b = baseline?.coverage?.[target];
  if (c.tests) {
    rows.push([`Tests ${title}`, c.tests.failed ? 'fail' : 'ok', `${c.tests.passed} de ${c.tests.total}${c.tests.failed ? ` · **${c.tests.failed} fallen**` : ''}`, delta(c.tests.total, b?.tests?.total)]);
  }
  const below = COVERAGE_METRICS.filter((m) => c[m] < c.thresholds[m]);
  rows.push([
    `Cobertura ${title}`,
    c.enforced && below.length ? 'fail' : 'ok',
    COVERAGE_METRICS.map((m) => `${LABELS[m]} ${pct(c[m])}`).join(' · '),
    b ? COVERAGE_METRICS.map((m) => delta(c[m], b[m])).join(' · ') : '',
  ]);
  if (c.lowFiles.length) {
    details.push([`Fitxers ${of} per sota del ${c.thresholds.lines} % de línies (${c.lowFiles.length})`, ['| Fitxer | Línies |', '|---|---:|', ...c.lowFiles.slice(0, 15).map((f) => `| \`${f.file}\` | ${pct(f.lines)} |`)]]);
  }
}

// E2E
if (metrics.e2e) {
  const t = Object.values(metrics.e2e.projects).reduce((a, p) => ({ passed: a.passed + p.passed, failed: a.failed + p.failed, flaky: a.flaky + p.flaky }), { passed: 0, failed: 0, flaky: 0 });
  const state = t.failed ? 'fail' : t.flaky ? 'warn' : 'ok';
  rows.push(['E2E', state, `${t.passed} superades${t.failed ? ` · **${t.failed} fallen**` : ''}${t.flaky ? ` · ${t.flaky} inestables` : ''} · ${metrics.e2e.durationSeconds} s`, '']);
  if (metrics.e2e.failures.length) {
    details.push(['Proves E2E que han fallat o són inestables', metrics.e2e.failures.map((f) => `- ${f.outcome === 'flaky' ? '⚠️ inestable' : '❌'} \`${f.project}\` ${f.title}`)]);
  }
} else rows.push(['E2E', 'none', 'no s\'han executat', '']);

// Accessibilitat (axe)
if (metrics.a11y) {
  const { byImpact, screens, violations } = metrics.a11y;
  const blocking = byImpact.critical + byImpact.serious;
  const other = byImpact.moderate + byImpact.minor;
  rows.push(['Accessibilitat (axe)', blocking ? 'fail' : other ? 'warn' : 'ok', `${screens} pantalles · ${blocking} greus · ${other} lleus`, '']);
  if (violations.length) {
    details.push(['Violacions d\'accessibilitat', ['| Pantalla | Regla | Impacte | Elements |', '|---|---|---|---|', ...violations.map((v) => `| ${v.screen} | [${v.id}](${'https://dequeuniversity.com/rules/axe/4.10/'}${v.id}) | ${v.impact} | \`${v.elements.join('`, `')}\` |`)]]);
  }
}

// Lighthouse
if (metrics.lighthouse) {
  const { average, pages } = metrics.lighthouse;
  const fail = pages.some((p) => p.scores.accessibility < LIGHTHOUSE_MIN.accessibility);
  const warn = pages.some((p) => LIGHTHOUSE_CATEGORIES.some((c) => p.scores[c] < LIGHTHOUSE_MIN[c]));
  rows.push([
    'Lighthouse',
    fail ? 'fail' : warn ? 'warn' : 'ok',
    LIGHTHOUSE_CATEGORIES.map((c) => `${LH_LABELS[c]} ${average[c]}`).join(' · '),
    baseline?.lighthouse ? LIGHTHOUSE_CATEGORIES.map((c) => delta(average[c], baseline.lighthouse.average[c])).join(' · ') : '',
  ]);
  details.push(['Lighthouse per pantalla', [`| Pantalla | ${LIGHTHOUSE_CATEGORIES.map((c) => LH_LABELS[c]).join(' | ')} |`, `|---|${LIGHTHOUSE_CATEGORIES.map(() => '---:').join('|')}|`, ...pages.map((p) => `| \`${p.url}\` | ${LIGHTHOUSE_CATEGORIES.map((c) => p.scores[c]).join(' | ')} |`)]]);
}

// Dependències (informatiu: la porta és el check «Dependències»)
if (metrics.dependencies) {
  const serious = Object.entries(metrics.dependencies.packages).flatMap(([pkg, c]) => ((c.critical ?? 0) + (c.high ?? 0) ? [`${pkg}: ${(c.critical ?? 0) + (c.high ?? 0)}`] : []));
  rows.push(['Dependències de producció', serious.length ? 'warn' : 'ok', serious.length ? `altes o crítiques · ${serious.join(' · ')}` : 'cap vulnerabilitat alta ni crítica', '']);
}

// Proves de mutació: només es fan cada nit; es mostra l'última de dev com a referència.
if (baseline?.mutation) {
  const m = baseline.mutation;
  rows.push(['Mutants morts (última nit a `dev`)', 'info', ['api', 'frontend'].filter((t) => m[t]).map((t) => `${t} ${pct(m[t].score)}`).join(' · '), '']);
}

const failed = rows.filter(([, state]) => state === 'fail').length;
const header = failed ? `❌ **${failed} ${failed === 1 ? 'comprovació falla' : 'comprovacions fallen'}**` : '✅ **Totes les comprovacions passen**';
const links = [sha && `Commit \`${sha.slice(0, 7)}\``, runUrl && `[execució i informes complets](${runUrl})`, env.QA_DASHBOARD_URL && `[tauler de QA](${env.QA_DASHBOARD_URL})`].filter(Boolean);
const markdown = [
  MARKER,
  '## Informe de QA',
  '',
  header,
  '',
  ...(baseline
    ? ['| | Resultat | Respecte a `dev` |', '|---|---|---|', ...rows.map(([name, state, text, d]) => `| ${ICON[state]} **${name}** | ${text} | ${d} |`)]
    : ['| | Resultat |', '|---|---|', ...rows.map(([name, state, text]) => `| ${ICON[state]} **${name}** | ${text} |`)]),
  '',
  ...details.flatMap(([title, lines]) => [`<details><summary>${title}</summary>`, '', ...lines, '', '</details>', '']),
  links.join(' · '),
  '',
  '<sub>Es genera a cada push; els llindars són a `tests/quality-gates.mjs` i les normes, a `TESTING.md`.</sub>',
].join('\n');

writeFileSync(join(REPORTS_DIR, 'qa-report.md'), `${markdown}\n`);
stepSummary(markdown.replace(MARKER, ''));
console.log(markdown);

/** Resum de dev per comparar: un URL (el tauler publicat) o un fitxer. Si no n'hi ha, no es compara. */
async function loadBaseline(source) {
  if (!source) return null;
  try {
    if (/^https?:/.test(source)) {
      const response = await fetch(source);
      return response.ok ? await response.json() : null;
    }
    return existsSync(source) ? JSON.parse(readFileSync(source, 'utf8')) : null;
  } catch {
    return null;
  }
}
