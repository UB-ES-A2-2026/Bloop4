// US-16 · Seguiment en un mapa: el rider comparteix la ubicació (geolocalització simulada) mentre fa el
// lliurament i el client el veu al mapa. Les tessel·les d'OpenStreetMap es substitueixen per una imatge
// buida: la prova no surt a internet. El lliurament en curs es prepara amb SQL.
import { test, expect } from './fixtures.mjs';
import { createVerifiedCustomer, signIn } from './support/accounts.mjs';
import { eventDates, pngImage } from './support/data.mjs';
import { canUseDatabase } from './support/db.mjs';
import { createBooking, createRider, userId } from './support/states.mjs';

const VALENCIA = { latitude: 39.4699, longitude: -0.3763, accuracy: 15 };

test.describe('US-16 · Seguiment en un mapa', () => {
  test.skip(!canUseDatabase, 'Necessita la base de dades del stack de proves');

  test('el rider comparteix la ubicació i el client el veu al mapa', async ({ browser, request }) => {
    const customer = await createVerifiedCustomer(request);
    const riderContext = await browser.newContext({ geolocation: VALENCIA, permissions: ['geolocation'] });
    const riderPage = await riderContext.newPage();
    const rider = await createRider(request, riderPage);
    const booking = createBooking({ customerId: userId(customer.email), day: eventDates(100 + test.info().parallelIndex).day, rider, serviceStatus: 'in_transit' });

    await riderPage.goto(`/repartidor/servicios/${booking.services.delivery}`);
    await expect(riderPage.getByRole('status').filter({ hasText: 'Estás compartiendo tu ubicación' })).toBeVisible();

    const customerContext = await browser.newContext();
    await customerContext.route('https://*.tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: pngImage(256, 256, [230, 230, 230]) }));
    const page = await customerContext.newPage();
    await signIn(page, customer);
    await page.goto(`/reservas/${booking.eventId}`);
    const map = page.getByRole('region', { name: 'Entrega de Sonido Levante S.L.' });
    await expect(map.getByRole('img', { name: /^Mapa:/ })).toBeVisible();
    await expect(map.getByText(/Ubicación actualizada hace/)).toBeVisible();
    await riderContext.close();
    await customerContext.close();
  });
});
