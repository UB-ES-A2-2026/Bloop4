// Genera el tauler de QA (web estàtica per a GitHub Pages) a partir dels informes de l'última CI de
// dev i de l'última execució nocturna, i hi afegeix el punt d'avui a l'historial.
// Ús: node scripts/dashboard.mjs --ci <carpeta> [--nightly <carpeta>] [--history <fitxer>] --out <carpeta>
// El workflow «Tauler de QA» el fa servir; en local es pot provar amb --ci reports --out site.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { COVERAGE_METRICS, collectMetrics, findFiles } from './lib/metrics.mjs';

const { values: args } = parseArgs({
  options: { ci: { type: 'string' }, nightly: { type: 'string' }, history: { type: 'string' }, out: { type: 'string' } },
});
if (!args.ci || !args.out) {
  console.error('Ús: node scripts/dashboard.mjs --ci <carpeta> [--nightly <carpeta>] [--history <fitxer>] --out <carpeta>');
  process.exit(2);
}

const MAX_HISTORY = 120;
const env = process.env;
const ci = collectMetrics(args.ci);
const nightly = args.nightly ? collectMetrics(args.nightly) : {};
const out = args.out;

/** S'executa al final del fitxer, quan ja hi ha totes les constants (CSS, formats). */
function main() {
  const latest = buildLatest();
  const history = updateHistory(readJsonIfExists(args.history) ?? [], latest);

  mkdirSync(join(out, 'data'), { recursive: true });
  writeFileSync(join(out, 'data', 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
  writeFileSync(join(out, 'data', 'history.json'), `${JSON.stringify(history)}\n`);
  const links = copyReports();
  writeFileSync(join(out, 'index.html'), renderIndex(latest, history, links, nightly.mutation));
  if (ci.coverage?.api) writeFileSync(join(out, 'coverage', 'api', 'index.html'), renderApiCoverage(args.ci));
  console.log(`Tauler generat a ${out} (${history.length} punts a l'historial).`);
}

/** Resum actual: el de la CI de dev, més la mutació, els navegadors i les dependències de la nit. */
function buildLatest() {
  const ciSummary = readJsonIfExists(findFiles(args.ci, (p) => basename(p) === 'qa-summary.json')[0]);
  const meta = ciSummary?.meta ?? {};
  const first = (...values) => values.find((v) => v != null) ?? null;
  const latest = {
    meta: {
      generatedAt: new Date().toISOString(),
      sha: first(meta.sha, env.QA_SHA),
      ciRunUrl: first(meta.runUrl, env.QA_CI_RUN_URL),
      nightlyRunUrl: first(env.QA_NIGHTLY_RUN_URL),
    },
    ...ci,
  };
  if (nightly.mutation) latest.mutation = withoutFiles(nightly.mutation);
  if (nightly.e2e) latest.browsers = nightly.e2e;
  if (nightly.dependencies) latest.allDependencies = nightly.dependencies;
  return latest;
}

// ---------------------------------------------------------------------------------------------

/** Còpia del resum de mutació sense el detall per fitxer (el detall només el fa servir la pàgina). */
function withoutFiles(mutation) {
  return Object.fromEntries(
    Object.entries(mutation).map(([key, value]) => {
      if (value && typeof value === 'object' && 'files' in value) {
        const { files: _files, ...rest } = value;
        return [key, rest];
      }
      return [key, value];
    }),
  );
}

function readJsonIfExists(file) {
  return file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/** Afegeix el punt d'avui (si el commit ja hi era, el substitueix) i conserva els últims MAX_HISTORY. */
function updateHistory(previous, l) {
  const point = {
    date: l.meta.generatedAt,
    sha: l.meta.sha,
    coverage: Object.fromEntries(
      ['api', 'frontend'].filter((t) => l.coverage?.[t]).map((t) => [t, { ...pick(l.coverage[t], COVERAGE_METRICS), tests: l.coverage[t].tests?.total ?? null }]),
    ),
    e2e: l.e2e ? totalsE2e(l.e2e) : null,
    lint: l.lint ? { errors: l.lint.errors, warnings: l.lint.warnings } : null,
    a11y: l.a11y ? { serious: l.a11y.byImpact.critical + l.a11y.byImpact.serious } : null,
    lighthouse: l.lighthouse?.average ?? null,
    mutation: l.mutation ? Object.fromEntries(['api', 'frontend'].filter((t) => l.mutation[t]).map((t) => [t, round1(l.mutation[t].score)])) : null,
  };
  const list = previous.filter((p) => !(p.sha && p.sha === point.sha && p.date.slice(0, 10) === point.date.slice(0, 10)));
  return [...list, point].slice(-MAX_HISTORY);
}

function pick(obj, keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}
function round1(n) {
  return Math.round(n * 10) / 10;
}
function totalsE2e(e2e) {
  return Object.values(e2e.projects).reduce((a, p) => ({ passed: a.passed + p.passed, failed: a.failed + p.failed, flaky: a.flaky + p.flaky }), {
    passed: 0,
    failed: 0,
    flaky: 0,
  });
}

/** Copia els informes HTML al web i en torna els enllaços. */
function copyReports() {
  const found = [];
  const copyDir = (from, to, label) => {
    if (!from) return;
    cpSync(from, join(out, to), { recursive: true });
    found.push({ href: `${to}/`, label });
  };
  const dirWith = (root, dirName, file) => findFiles(root, (p) => basename(p) === file && basename(dirname(p)) === dirName).map(dirname)[0];

  copyDir(dirWith(args.ci, 'coverage', 'index.html'), 'coverage/frontend', 'Cobertura del frontend (Vitest)');
  if (ci.coverage?.api) {
    mkdirSync(join(out, 'coverage', 'api'), { recursive: true });
    found.push({ href: 'coverage/api/', label: 'Cobertura de l\'API per fitxer' });
  }
  copyDir(dirWith(args.ci, 'playwright-report', 'index.html'), 'e2e', 'Proves E2E (Playwright)');
  const lighthouse = findFiles(args.ci, (p) => basename(dirname(p)) === 'lighthouse' && p.endsWith('.html'));
  // Lighthouse deixa un informe per passada; n'hi ha prou amb el representatiu de cada pantalla.
  const representative = new Set((ci.lighthouse?.pages ?? []).map((p) => p.report && basename(p.report)));
  for (const file of lighthouse.filter((f) => representative.has(basename(f)))) {
    mkdirSync(join(out, 'lighthouse'), { recursive: true });
    cpSync(file, join(out, 'lighthouse', basename(file)));
    const page = ci.lighthouse.pages.find((p) => p.report && basename(p.report) === basename(file));
    found.push({ href: `lighthouse/${basename(file)}`, label: `Lighthouse · ${page.url}` });
  }
  if (args.nightly) {
    for (const file of findFiles(args.nightly, (p) => basename(dirname(p)) === 'mutation' && p.endsWith('.html'))) {
      mkdirSync(join(out, 'mutation'), { recursive: true });
      cpSync(file, join(out, 'mutation', basename(file)));
      const label = { 'api-unit.html': 'Mutació · API', 'api-db.html': 'Mutació · API (mòduls amb BD)', 'frontend.html': 'Mutació · frontend' }[basename(file)];
      found.push({ href: `mutation/${basename(file)}`, label: label ?? `Mutació · ${basename(file)}` });
    }
  }
  return found;
}

// --- HTML -------------------------------------------------------------------------------------

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const fmt = (n, digits = 1) => (n == null ? '—' : n.toLocaleString('ca-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const fmtDate = (iso) => new Date(iso).toLocaleString('ca-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Gràfic de línies en SVG: un eix, una sèrie per color, l'últim valor etiquetat i un <title> a cada punt. */
function lineChart({ title, series, dates, min = 0, max = 100, unit = '', threshold }) {
  const W = 640;
  const H = 200;
  const pad = { l: 40, r: 70, t: 12, b: 26 };
  const n = dates.length;
  const x = (i) => pad.l + (n === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const grid = ticks
    .map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pad.l - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${fmt(t, 0)}</text>`)
    .join('');
  const thr = threshold != null ? `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(threshold)}" y2="${y(threshold)}" class="thr"/>` : '';
  const lines = series
    .map((s, si) => {
      const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v), v, i])).filter(Boolean);
      if (!pts.length) return '';
      const path = pts.map(([px, py], k) => `${k ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
      const dots = pts
        .map(([px, py, v, i]) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${i === n - 1 ? 4 : 2.5}" class="s${si + 1}"><title>${esc(s.name)} · ${fmtDate(dates[i])}: ${fmt(v, unit === '%' ? 1 : 0)}${unit && ` ${unit}`}</title></circle>`)
        .join('');
      const [lx, ly, lv] = pts.at(-1);
      return `<path d="${path}" class="line s${si + 1}"/>${dots}<text x="${lx + 8}" y="${ly + 4}" class="val">${fmt(lv, unit === '%' ? 1 : 0)}${unit && ` ${unit}`}</text>`;
    })
    .join('');
  const legend =
    series.length > 1 ? `<div class="legend">${series.map((s, i) => `<span><i class="s${i + 1}"></i>${esc(s.name)}</span>`).join('')}${threshold != null ? '<span><i class="thr"></i>llindar</span>' : ''}</div>` : '';
  const axis = n > 1 ? `<text x="${pad.l}" y="${H - 6}" class="tick">${fmtDate(dates[0])}</text><text x="${W - pad.r}" y="${H - 6}" class="tick" text-anchor="end">${fmtDate(dates[n - 1])}</text>` : '';
  const note = n === 1 ? '<p class="note">L\'evolució es veurà a partir de la segona actualització.</p>' : '';
  return `<figure class="chart"><figcaption>${esc(title)}</figcaption>${legend}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${grid}${thr}${lines}${axis}</svg>${note}</figure>`;
}

function state(ok, warn = false) {
  return ok ? (warn ? '<span class="pill warn">▲ avís</span>' : '<span class="pill ok">✓ correcte</span>') : '<span class="pill fail">✕ falla</span>';
}

function renderIndex(l, hist, reportLinks, mutationDetail) {
  const lowFiles = renderLowFiles(l.coverage ?? {});
  const weakMutation = renderWeakMutation(mutationDetail);
  const links = reportLinks.map((r) => `<li><a href="${esc(r.href)}">${esc(r.label)}</a></li>`).join('');
  return `<!doctype html>
<html lang="ca">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tauler de QA · Bloop4</title>
<style>${CSS}</style>
</head>
<body>
<main>
  <header>
    <p class="eyebrow">Bloop4 · branca dev</p>
    <h1>Tauler de QA</h1>
    <p class="meta">${renderMeta(l.meta)}</p>
  </header>
  <section class="tiles">${renderTiles(l)}</section>
  <section><h2>Evolució</h2><div class="charts">${renderCharts(hist)}</div></section>
  <section class="cols">
    <div><h2>Navegadors (cada nit)</h2>${renderBrowsers(l.browsers)}</div>
    <div><h2>Informes complets</h2><ul class="links">${links}<li><a href="data/history.json">Historial en JSON</a></li></ul></div>
  </section>
  ${lowFiles ? `<section><h2>Fitxers per sota del llindar de cobertura</h2><div class="cols">${lowFiles}</div></section>` : ''}
  ${weakMutation ? `<section><h2>Fitxers amb menys mutants morts</h2>${weakMutation}</section>` : ''}
  <footer>Es regenera a cada push a <code>dev</code> i cada nit. Les normes i els llindars són a <code>TESTING.md</code>.</footer>
</main>
</body>
</html>
`;
}

function renderMeta(meta) {
  const repoUrl = env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}` : null;
  const sha = meta.sha && `<code>${esc(meta.sha.slice(0, 7))}</code>`;
  return [
    `Actualitzat el ${fmtDate(meta.generatedAt)}`,
    sha && (repoUrl ? `commit <a href="${repoUrl}/commit/${esc(meta.sha)}">${sha}</a>` : `commit ${sha}`),
    meta.ciRunUrl && `<a href="${esc(meta.ciRunUrl)}">última CI de dev</a>`,
    meta.nightlyRunUrl && `<a href="${esc(meta.nightlyRunUrl)}">última nit</a>`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Una targeta per mètrica; cadascuna només surt si n'hi ha dades. */
function renderTiles(l) {
  const coverageTile = (target, label) => {
    const c = l.coverage?.[target];
    return c && tile(label, `${fmt(c.lines)} %`, `${c.tests?.total ?? '—'} tests · llindar ${c.thresholds.lines} %`, state(c.lines >= c.thresholds.lines));
  };
  const e2eTile = () => {
    if (!l.e2e) return null;
    const e = totalsE2e(l.e2e);
    const extra = `${e.failed ? ` · ${e.failed} fallen` : ''}${e.flaky ? ` · ${e.flaky} inestables` : ''}`;
    return tile('E2E', `${e.passed}`, `superades a Chromium${extra}`, state(!e.failed, e.flaky > 0));
  };
  const a11yTile = () => {
    if (!l.a11y) return null;
    const severe = l.a11y.byImpact.critical + l.a11y.byImpact.serious;
    return tile('Accessibilitat', `${severe}`, `violacions greus en ${l.a11y.screens} pantalles (axe)`, state(severe === 0));
  };
  const lighthouseTile = () => {
    const lh = l.lighthouse?.average;
    return lh && tile('Lighthouse', `${lh.accessibility}`, `accessibilitat · rendiment ${lh.performance} · SEO ${lh.seo}`, state(lh.accessibility >= 90, lh.performance < 80 || lh.seo < 80));
  };
  const mutationTile = () => {
    const m = l.mutation;
    return m?.api && tile('Mutants morts', `${fmt(m.api.score)} %`, `API · frontend ${fmt(m.frontend?.score)} % (cada nit)`, state(true, m.api.score < 70));
  };
  const lintTile = () => l.lint && tile('Lint', `${l.lint.errors}`, `errors · ${l.lint.warnings} avisos`, state(l.lint.errors === 0));
  return [coverageTile('api', 'Cobertura API'), coverageTile('frontend', 'Cobertura frontend'), e2eTile(), a11yTile(), lighthouseTile(), mutationTile(), lintTile()]
    .filter(Boolean)
    .join('');
}

function renderCharts(hist) {
  const dates = hist.map((p) => p.date);
  const series = (fn) => hist.map((p) => fn(p) ?? null);
  return [
    lineChart({
      title: 'Cobertura de línies',
      unit: '%',
      dates,
      series: [
        { name: 'API', values: series((p) => p.coverage?.api?.lines) },
        { name: 'Frontend', values: series((p) => p.coverage?.frontend?.lines) },
      ],
    }),
    lineChart({
      title: 'Nombre de tests',
      dates,
      max: niceMax(hist.flatMap((p) => [p.coverage?.api?.tests, p.coverage?.frontend?.tests, p.e2e?.passed])),
      series: [
        { name: 'API', values: series((p) => p.coverage?.api?.tests) },
        { name: 'Frontend', values: series((p) => p.coverage?.frontend?.tests) },
        { name: 'E2E', values: series((p) => p.e2e && p.e2e.passed + p.e2e.failed + p.e2e.flaky) },
      ],
    }),
    lineChart({
      title: 'Mutants morts (proves de mutació, cada nit)',
      unit: '%',
      dates,
      threshold: 70,
      series: [
        { name: 'API', values: series((p) => p.mutation?.api) },
        { name: 'Frontend', values: series((p) => p.mutation?.frontend) },
      ],
    }),
    lineChart({
      title: 'Lighthouse (mitjana de les pantalles)',
      dates,
      series: [
        { name: 'Accessibilitat', values: series((p) => p.lighthouse?.accessibility) },
        { name: 'Rendiment', values: series((p) => p.lighthouse?.performance) },
      ],
    }),
  ].join('');
}

function renderBrowsers(browsers) {
  if (!browsers) return '<p class="note">Encara no hi ha cap execució nocturna.</p>';
  return table(
    ['Navegador', 'Superades', 'Fallen', 'Inestables'],
    Object.entries(browsers.projects).map(([name, p]) => [name, p.passed, p.failed, p.flaky]),
  );
}

function renderLowFiles(coverage) {
  return ['api', 'frontend']
    .filter((t) => coverage[t]?.lowFiles?.length)
    .map((t) => table([`Fitxer (${t === 'api' ? 'API' : 'frontend'})`, 'Línies'], coverage[t].lowFiles.slice(0, 12).map((f) => [`<code>${esc(f.file)}</code>`, `${fmt(f.lines)} %`])))
    .join('');
}

function renderWeakMutation(detail) {
  if (!detail) return '';
  const rows = ['api', 'frontend']
    .flatMap((t) => detail[t]?.files ?? [])
    .filter((f) => f.total >= 5)
    .sort((a, b) => a.coveredScore - b.coveredScore)
    .slice(0, 10)
    .map((f) => [`<code>${esc(f.file)}</code>`, `${fmt(f.coveredScore)} %`, f.survived]);
  return rows.length ? table(['Fitxer', 'Mutants morts (codi cobert)', 'Sobreviuen'], rows) : '';
}

function tile(label, value, sub, pill) {
  return `<div class="tile"><div class="k">${esc(label)}</div><div class="v">${esc(value)}</div><div class="s">${esc(sub)}</div>${pill}</div>`;
}
function table(head, rows) {
  return `<div class="table"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((cell, i) => `<td${i ? ' class="num"' : ''}>${typeof cell === 'number' ? cell : cell}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}
function niceMax(values) {
  const m = Math.max(10, ...values.filter((v) => v != null));
  const step = 10 ** Math.floor(Math.log10(m));
  return Math.ceil((m * 1.1) / step) * step;
}

function renderApiCoverage(root) {
  const file = findFiles(root, (p) => basename(p) === 'coverage-api.json')[0];
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const p = (m) => (m.total ? `${fmt((100 * m.covered) / m.total)} %` : '—');
  const rows = [...r.files]
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((f) => [`<code>${esc(f.file)}</code>`, p(f.lines), p(f.branches), p(f.functions)]);
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cobertura de l'API · Bloop4</title><style>${CSS}</style></head><body><main><p class="eyebrow"><a href="../../">← Tauler de QA</a></p><h1>Cobertura de l'API</h1><p class="meta">node:test amb PostgreSQL. Els fitxers que cap test carrega compten com a 0 %.</p>${table(['Fitxer', 'Línies', 'Branques', 'Funcions'], rows)}</main></body></html>\n`;
}

const CSS = `
:root{--bg:#f5f6f8;--surface:#fff;--fg:#15181d;--fg2:#4a505a;--muted:#6b7079;--line:#dde1e7;--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--ok:#006300;--warn:#8a5a00;--fail:#b42a2a;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#111316;--surface:#1a1a19;--fg:#eceef1;--fg2:#bcc2cb;--muted:#8e95a0;--line:#2e333a;--s1:#3987e5;--s2:#d95926;--s3:#199e70;--ok:#4fc36a;--warn:#fab219;--fail:#ef7272;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1120px;margin:0 auto;padding:32px 16px 64px;display:grid;gap:32px}
h1{font-size:2rem;margin:0}h2{font-size:1.15rem;margin:0 0 12px}.eyebrow{margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.meta,.note,footer{color:var(--muted);font-size:13.5px}a{color:var(--s1)}code{font:12.5px ui-monospace,Menlo,Consolas,monospace}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px;display:grid;gap:4px;align-content:start}
.tile .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}.tile .v{font-size:1.8rem;font-weight:650;font-variant-numeric:tabular-nums}.tile .s{font-size:13px;color:var(--fg2)}
.pill{justify-self:start;font-size:12px;font-weight:600;border:1px solid currentColor;border-radius:999px;padding:1px 8px}.pill.ok{color:var(--ok)}.pill.warn{color:var(--warn)}.pill.fail{color:var(--fail)}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:16px}
.chart{margin:0;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px}figcaption{font-weight:600;margin-bottom:6px}
svg{width:100%;height:auto;display:block}.grid{stroke:var(--line);stroke-width:1}.thr{stroke:var(--fg);stroke-width:1.5;stroke-dasharray:4 3}
.tick{fill:var(--muted);font-size:11px}.val{fill:var(--fg);font-size:12px;font-variant-numeric:tabular-nums}
.line{fill:none;stroke-width:2}.line.s1{stroke:var(--s1)}.line.s2{stroke:var(--s2)}.line.s3{stroke:var(--s3)}
circle.s1{fill:var(--s1)}circle.s2{fill:var(--s2)}circle.s3{fill:var(--s3)}circle{stroke:var(--surface);stroke-width:1.5}
.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:var(--fg2);margin-bottom:4px}.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{width:12px;height:12px;border-radius:3px;display:inline-block}.legend i.s1{background:var(--s1)}.legend i.s2{background:var(--s2)}.legend i.s3{background:var(--s3)}.legend i.thr{height:2px;background:var(--fg)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:16px;align-items:start}
.table{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px}table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line)}th{font-size:12px;color:var(--muted)}tr:last-child td{border-bottom:0}td.num{text-align:right;font-variant-numeric:tabular-nums}
.links{margin:0;padding-left:1.1em;display:grid;gap:6px}
`;

main();
