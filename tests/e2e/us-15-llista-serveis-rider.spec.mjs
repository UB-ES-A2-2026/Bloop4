// US-15 · Llista de serveis del rider: els serveis del dia, el detall amb l'adreça i l'enllaç al mapa,
// i un dia sense serveis. Els serveis assignats es preparen amb SQL.
import { test, expect } from './fixtures.mjs';
import { createVerifiedCustomer } from './support/accounts.mjs';
import { eventDates } from './support/data.mjs';
import { canUseDatabase } from './support/db.mjs';
import { createBooking, createRider, userId } from './support/states.mjs';

test.describe('US-15 · Llista de serveis del rider', () => {
  test.skip(!canUseDatabase, 'Necessita la base de dades del stack de proves');

  test('el rider veu el servei del dia, n\'obre el detall i té l\'enllaç al mapa', async ({ page, request, checkA11y }) => {
    const { day, nextDay } = eventDates(70 + test.info().parallelIndex);
    const customer = await createVerifiedCustomer(request);
    const rider = await createRider(request, page);
    createBooking({ customerId: userId(customer.email), day, rider });

    await page.goto(`/repartidor?dia=${day}`);
    const services = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Ver detalle' }) });
    await expect(services).toHaveCount(1);
    await expect(services.first()).toContainText('Calle de Proves 1');
    await checkA11y('serveis del rider');

    await services.first().getByRole('link', { name: 'Ver detalle' }).click();
    await expect(page.getByText(customer.fullName)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Abrir en el mapa' })).toHaveAttribute(
      'href',
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Calle%20de%20Proves%201/,
    );

    await page.goto(`/repartidor?dia=${nextDay}`);
    await page.getByLabel('Día').fill(eventDates(300 + test.info().parallelIndex).day);
    await expect(page.getByText('No tienes servicios este día')).toBeVisible();
  });
});
