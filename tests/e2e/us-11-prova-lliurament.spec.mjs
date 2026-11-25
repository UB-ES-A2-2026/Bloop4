// US-11 · Prova de lliurament: sense foto no es pot completar; amb la foto i l'estat de la línia, el
// servei queda completat i el client en veu la prova. El lliurament en curs es prepara amb SQL.
import { test, expect } from './fixtures.mjs';
import { createVerifiedCustomer, signIn } from './support/accounts.mjs';
import { eventDates, pngImage } from './support/data.mjs';
import { canUseDatabase } from './support/db.mjs';
import { PRODUCTS, createBooking, createRider, userId } from './support/states.mjs';

test.describe('US-11 · Prova de lliurament', () => {
  test.skip(!canUseDatabase, 'Necessita la base de dades del stack de proves');

  test('el rider completa el lliurament amb la foto i l\'estat, i el client veu la prova', async ({ browser, page, request, checkA11y }) => {
    const customer = await createVerifiedCustomer(request);
    const rider = await createRider(request, page);
    const booking = createBooking({
      customerId: userId(customer.email),
      day: eventDates(90 + test.info().parallelIndex).day,
      items: [{ product: PRODUCTS.silla, quantity: 10 }],
      rider,
      serviceStatus: 'in_transit',
    });

    await page.goto(`/repartidor/servicios/${booking.services.delivery}`);
    const form = page.getByRole('form', { name: 'Completar la entrega' });
    await form.getByRole('radio', { name: 'Correcto' }).check();
    await form.getByRole('button', { name: 'Completar entrega' }).click();
    await expect(form.getByText('Falta al menos una foto.')).toBeVisible();
    await checkA11y('prova del rider');

    await form.getByLabel('Añadir foto').setInputFiles({ name: 'cadires.png', mimeType: 'image/png', buffer: pngImage() });
    await expect(form.getByRole('list', { name: `Fotos de ${PRODUCTS.silla.name}` }).getByRole('listitem')).toHaveCount(1);
    await form.getByRole('button', { name: 'Completar entrega' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Servicio completado' })).toBeVisible();

    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto(`/pruebas/${booking.services.delivery}`);
    await expect(customerPage.getByText('Correcto')).toBeVisible();
    await expect(customerPage.getByRole('img').first()).toBeVisible();
    await customerContext.close();
  });
});
