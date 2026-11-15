// Catàleg públic: un visitant sense compte troba un producte i n'obre la fitxa.
import { test, expect } from './fixtures.mjs';

test.describe('US-00 · US-01 · US-02 · US-03 · Catàleg i fitxa de producte', () => {
  test('un visitant filtra per categoria, cerca i obre la fitxa d\'un producte', async ({ catalogPage, productPage, checkA11y }) => {
    await catalogPage.goto();
    await expect(catalogPage.resultsCount).toHaveText(/^\d+ productos$/);
    await checkA11y('catàleg');

    // US-02: una categoria arrel inclou els productes de les subcategories.
    await catalogPage.toggleCategory('Sonido');
    await expect(catalogPage.resultsCount).toHaveText('5 productos');

    // US-01: la cerca no té en compte els accents i es combina amb el filtre.
    await catalogPage.search('microfono');
    await expect(catalogPage.products).toHaveCount(2);
    await expect(catalogPage.card('Micrófono inalámbrico de mano')).toBeVisible();

    // US-03: la fitxa mostra el preu, les especificacions i el venedor.
    await catalogPage.openProduct('Micrófono inalámbrico de mano');
    await expect(productPage.heading).toHaveText('Micrófono inalámbrico de mano');
    await expect(productPage.specs).toBeVisible();
    await expect(productPage.page.getByText('Sonido Levante S.L.')).toBeVisible();
    await checkA11y('fitxa de producte');
  });

  test('una cerca sense resultats ho diu i permet tornar al catàleg sencer', async ({ catalogPage }) => {
    await catalogPage.goto();
    await catalogPage.search('zzzz-no-existeix');
    await expect(catalogPage.products).toHaveCount(0);
    await catalogPage.page.getByRole('button', { name: 'Borrar búsqueda' }).click();
    await expect(catalogPage.products.first()).toBeVisible();
  });

  test('una fitxa que no existeix mostra «Producto no disponible»', async ({ productPage }) => {
    await productPage.goto('d0000000-0000-4000-8000-000000000099');
    await expect(productPage.page.getByRole('heading', { name: 'Producto no disponible' })).toBeVisible();
  });
});
