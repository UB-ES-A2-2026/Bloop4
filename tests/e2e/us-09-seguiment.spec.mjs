// US-09 · Seguiment de la comanda: el rider inicia el lliurament i el client ho veu sense recarregar la
// pàgina (consulta periòdica), amb un avís a la campana. La reserva i els serveis es preparen amb SQL.
import { test, expect } from './fixtures.mjs';
import { createVerifiedCustomer, signIn } from './support/accounts.mjs';
import { eventDates } from './support/data.mjs';
import { canUseDatabase } from './support/db.mjs';
import { createBooking, createRider, userId } from './support/states.mjs';

test.describe('US-09 · Seguiment de la comanda', () => {
  test.skip(!canUseDatabase, 'Necessita la base de dades del stack de proves');
  // La campana es torna a demanar cada 30 s.
  test.setTimeout(120_000);

  test('el rider inicia el lliurament i el client veu «En camino» i l\'avís', async ({ browser, page, request }) => {
    const customer = await createVerifiedCustomer(request);
    const rider = await createRider(request, page);
    const booking = createBooking({ customerId: userId(customer.email), day: eventDates(80 + test.info().parallelIndex).day, rider });

    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customer);
    await customerPage.goto(`/reservas/${booking.eventId}`);
    const tracking = customerPage.getByRole('region', { name: 'Seguimiento de Sonido Levante S.L.' });
    await expect(tracking).toBeVisible();

    await page.goto(`/repartidor/servicios/${booking.services.delivery}`);
    await page.getByRole('button', { name: 'Iniciar entrega' }).click();
    await expect(page.getByText('En curso', { exact: true })).toBeVisible();

    // Sense recarregar: la pàgina del client es posa al dia sola.
    await expect(tracking.locator('[aria-current="step"]')).toContainText('En camino', { timeout: 15_000 });
    await expect(customerPage.getByLabel('1 sin leer')).toBeVisible({ timeout: 40_000 });
    await customerContext.close();
  });
});
