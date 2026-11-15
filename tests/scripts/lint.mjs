// Passa ESLint per api/, bloop4-frontend/ i tests/ amb tests/eslint.config.js.
// Ús (des de tests/): npm run lint   ·   npm run lint:fix (corregeix el que es pugui automàticament)
// Falla si hi ha algun error. A la CI, a més, anota cada avís al PR i en deixa el resum al job.
import { ESLint } from 'eslint';
import { join } from 'node:path';
import { ROOT, annotate, repoPath, stepSummary, writeReport } from './lib/ci.mjs';

const TARGETS = ['api', 'bloop4-frontend', 'tests'];
const fix = process.argv.includes('--fix');

const eslint = new ESLint({ cwd: ROOT, overrideConfigFile: join(ROOT, 'tests', 'eslint.config.js'), fix });
const results = await eslint.lintFiles(TARGETS);
if (fix) await ESLint.outputFixes(results);

const output = await (await eslint.loadFormatter('stylish')).format(results);
if (output) console.log(output);

let errors = 0;
let warnings = 0;
const byRule = {};
const messages = [];
for (const result of results) {
  for (const m of result.messages) {
    const level = m.severity === 2 ? 'error' : 'warning';
    if (level === 'error') errors++;
    else warnings++;
    const rule = m.ruleId ?? 'parse';
    byRule[rule] ??= { errors: 0, warnings: 0 };
    byRule[rule][level === 'error' ? 'errors' : 'warnings']++;
    const file = repoPath(result.filePath);
    messages.push({ level, rule, file, line: m.line, message: m.message });
    annotate(level, { file, line: m.line, col: m.column, title: `ESLint (${rule})`, message: m.message });
  }
}

writeReport('eslint', { files: results.length, errors, warnings, byRule, messages });

const rows = Object.entries(byRule)
  .sort(([, a], [, b]) => b.errors - a.errors || b.warnings - a.warnings)
  .map(([rule, n]) => `| \`${rule}\` | ${n.errors} | ${n.warnings} |`);
stepSummary(
  [
    `### ${errors ? '❌' : '✅'} Lint (ESLint)`,
    '',
    `${results.length} fitxers · **${errors} errors** · ${warnings} avisos`,
    '',
    ...(rows.length ? ['| Regla | Errors | Avisos |', '|---|---:|---:|', ...rows] : []),
  ].join('\n'),
);

console.log(`\nESLint: ${results.length} fitxers, ${errors} errors, ${warnings} avisos.`);
process.exitCode = errors > 0 ? 1 : 0;
