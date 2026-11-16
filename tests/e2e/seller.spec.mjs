// Un venedor publica un producte nou i surt al catàleg públic.
import { test, expect } from './fixtures.mjs';
import { SEED_SELLER, signIn } from './support/accounts.mjs';
import { pngImage } from './support/data.mjs';

test.describe('US-10 · Publicació de productes', () => {
  test('un venedor crea un esborrany, hi puja una foto, el publica i surt al catàleg', async ({
    page,
    sellerHomePage,
    sellerProductFormPage: form,
    catalogPage,
    checkA11y,
  }) => {
    const name = `Silla plegable E2E ${Date.now().toString(36)}`;
    await signIn(page, SEED_SELLER);

    await sellerHomePage.goto();
    await sellerHomePage.newProduct.click();
    await checkA11y('producte nou');
    await form.fill({
      category: 'Sillas',
      Nombre: name,
      'Precio por día (€)': '3.50',
      'Fianza (€)': '10',
      Unidades: '20',
      'Peso (kg)': '4',
      'Largo (cm)': '45',
      'Ancho (cm)': '45',
      'Alto (cm)': '80',
    });
    await form.saveDraft.click();
    await expect(form.statusBadge).toHaveText('Borrador');

    // Un esborrany no surt al catàleg. (La cerca és aproximada: també torna les cadires d'altres execucions.)
    const inCatalog = async () => {
      const { data } = await (await page.request.get(`/api/products?q=${encodeURIComponent(name)}&pageSize=100`)).json();
      return data.some((p) => p.name === name);
    };
    expect(await inCatalog()).toBe(false);

    await form.uploadPhoto({ name: 'silla.png', mimeType: 'image/png', buffer: pngImage() });
    await form.publish();
    await expect(form.statusBadge).toHaveText('Publicado');

    expect(await inCatalog()).toBe(true);
    await catalogPage.goto();
    await catalogPage.search(name);
    await expect(catalogPage.card(name)).toBeVisible();
  });
});
