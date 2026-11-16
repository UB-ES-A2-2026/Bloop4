// Llegeix els informes que deixen els scripts de QA (tests/reports/ en local, o els artefactes
// descarregats d'una execució de la CI) i en fa un resum únic: el que mostren el comentari del PR
// i el tauler. Cada informe es busca pel nom a qualsevol subcarpeta; si no hi és, la secció falta.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const COVERAGE_METRICS = ['lines', 'branches', 'functions'];
export const LIGHTHOUSE_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
/** Puntuació mínima de Lighthouse: per sota de l'accessibilitat falla; de les altres, avís. */
export const LIGHTHOUSE_MIN = { performance: 80, accessibility: 90, 'best-practices': 90, seo: 80 };
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

export function findFiles(root, predicate, out = []) {
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') findFiles(path, predicate, out);
    } else if (predicate(path)) out.push(path);
  }
  return out;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const named = (root, name) => findFiles(root, (p) => basename(p) === name);
const round1 = (n) => Math.round(n * 10) / 10;

/** Resum de tots els informes trobats sota `root`. Cada secció només hi és si n'hi ha l'informe. */
export function collectMetrics(root) {
  const sections = {
    coverage: collectCoverage,
    lint: collectLint,
    dependencies: collectAudit,
    e2e: (r) => {
      const reports = named(r, 'playwright.json');
      return reports.length ? collectPlaywright(reports.map(readJson)) : undefined;
    },
    a11y: collectA11y,
    lighthouse: collectLighthouse,
    mutation: (r) => {
      const [file] = named(r, 'mutation.json');
      return file ? readJson(file) : undefined;
    },
  };
  const metrics = {};
  for (const [name, collect] of Object.entries(sections)) {
    const value = collect(root);
    if (value !== undefined) metrics[name] = value;
  }
  return metrics;
}

function collectCoverage(root) {
  const coverage = {};
  for (const target of ['api', 'frontend']) {
    const [file] = named(root, `coverage-${target}.json`);
    if (!file) continue;
    const r = readJson(file);
    const linePct = (f) => (100 * f.lines.covered) / f.lines.total;
    coverage[target] = {
      ...Object.fromEntries(COVERAGE_METRICS.map((m) => [m, round1(r.total[m].pct)])),
      thresholds: r.thresholds,
      enforced: r.enforced,
      tests: r.tests ?? null,
      lowFiles: r.files
        .filter((f) => f.lines.total > 0 && linePct(f) < r.thresholds.lines)
        .map((f) => ({ file: f.file, lines: round1(linePct(f)) }))
        .sort((a, b) => a.lines - b.lines),
    };
  }
  return Object.keys(coverage).length ? coverage : undefined;
}

function collectLint(root) {
  const [file] = named(root, 'eslint.json');
  if (!file) return undefined;
  const r = readJson(file);
  return { files: r.files, errors: r.errors, warnings: r.warnings, byRule: r.byRule };
}

function collectAudit(root) {
  const [file] = named(root, 'audit.json');
  if (!file) return undefined;
  const r = readJson(file);
  return { includeDev: r.includeDev, packages: Object.fromEntries(Object.entries(r.packages).map(([pkg, p]) => [pkg, p.counts])) };
}

function collectA11y(root) {
  const files = findFiles(root, (p) => basename(dirname(p)) === 'a11y' && p.endsWith('.json'));
  if (!files.length) return undefined;
  const screens = files.map(readJson);
  const byImpact = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
  const violations = [];
  for (const s of screens) {
    for (const v of s.violations) {
      byImpact[v.impact] = (byImpact[v.impact] ?? 0) + 1;
      violations.push({ screen: s.screen, project: s.project, id: v.id, impact: v.impact, help: v.help, elements: v.elements.slice(0, 5) });
    }
  }
  return { screens: screens.length, byImpact, violations };
}

function collectLighthouse(root) {
  const [file] = named(root, 'lighthouse.json');
  if (!file) return undefined;
  const { pages } = readJson(file);
  const average = Object.fromEntries(
    LIGHTHOUSE_CATEGORIES.map((c) => [c, Math.round(pages.reduce((sum, p) => sum + p.scores[c], 0) / pages.length)]),
  );
  return { pages, average };
}

/** Proves de Playwright per projecte (navegador): superades, fallades, inestables i omeses. */
function collectPlaywright(reports) {
  const projects = {};
  const failures = [];
  const walk = (suite, titles) => {
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title]);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        const p = (projects[test.projectName] ??= { passed: 0, failed: 0, flaky: 0, skipped: 0 });
        const outcome = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' }[test.status] ?? 'failed';
        p[outcome]++;
        if (outcome === 'failed' || outcome === 'flaky') {
          failures.push({ project: test.projectName, outcome, title: [...titles, spec.title].filter(Boolean).join(' › '), file: spec.file });
        }
      }
    }
  };
  let duration = 0;
  for (const report of reports) {
    for (const suite of report.suites) walk(suite, []);
    duration += report.stats?.duration ?? 0;
  }
  return { projects, failures, durationSeconds: Math.round(duration / 1000) };
}
