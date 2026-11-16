// Anàlisi d'accessibilitat amb axe-core (WCAG 2.1 A i AA) de la pantalla que hi ha oberta.
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPORTS_DIR } from '../../scripts/lib/ci.mjs';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
/** Impactes que fan fallar la prova. Els altres (minor, moderate) queden a l'informe. */
export const BLOCKING_IMPACTS = ['serious', 'critical'];

/**
 * Analitza la pàgina, adjunta el resultat a la prova (informe HTML de Playwright), el desa a
 * tests/reports/a11y/ i falla (sense aturar el recorregut) si hi ha violacions greus.
 */
export async function checkA11y(page, testInfo, screen) {
  // Les entrades animades (bloopIn) comencen transparents: si axe les mira a mitja animació, dona
  // falsos errors de contrast. S'espera que acabin les animacions finites (no els esquelets en bucle).
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    elements: v.nodes.map((n) => n.target.join(' ')),
  }));

  await testInfo.attach(`accessibilitat · ${screen}`, { body: JSON.stringify(violations, null, 2), contentType: 'application/json' });
  const dir = join(REPORTS_DIR, 'a11y');
  mkdirSync(dir, { recursive: true });
  const slug = `${testInfo.project.name}-${screen}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  writeFileSync(
    join(dir, `${slug}.json`),
    `${JSON.stringify({ screen, url: page.url(), project: testInfo.project.name, passes: results.passes.length, violations }, null, 2)}\n`,
  );

  const blocking = violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact));
  expect
    .soft(blocking, `Accessibilitat de «${screen}»: ${blocking.map((v) => `${v.id} (${v.elements.join(', ')})`).join('; ')}`)
    .toEqual([]);
}
