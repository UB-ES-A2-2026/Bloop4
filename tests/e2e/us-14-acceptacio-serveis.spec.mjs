// US-14 · Acceptació de serveis pel rider: veu els serveis pendents sense l'adreça del client i n'accepta
// un. La reserva confirmada es prepara amb SQL, amb un codi postal propi per trobar-ne els serveis.
import { test, expect } from './fixtures.mjs';
import { createVerifiedCustomer } from './support/accounts.mjs';
import { eventDates } from './support/data.mjs';
import { canUseDatabase } from './support/db.mjs';
import { createBooking, createRider, uniquePostalCode, userId } from './support/states.mjs';

test.describe('US-14 · Acceptació de serveis pel rider', () => {
  test.skip(!canUseDatabase, 'Necessita la base de dades del stack de proves');

  test('el rider veu el servei sense l\'adreça del client i l\'accepta', async ({ page, request, checkA11y }) => {
    const index = test.info().parallelIndex;
    const customer = await createVerifiedCustomer(request);
    const postalCode = uniquePostalCode(index);
    createBooking({ customerId: userId(customer.email), day: eventDates(60 + index).day, postalCode });
    await createRider(request, page, { vehicle: 'van' });

    await page.goto('/repartidor/disponibles');
    await expect(page.getByRole('heading', { level: 1, name: 'Servicios disponibles' })).toBeVisible();
    const ours = page.locator('article').filter({ hasText: postalCode });
    await expect(ours).toHaveCount(2);
    await expect(page.getByText('Calle de Proves 1')).toHaveCount(0);
    await checkA11y('serveis disponibles');

    await ours.filter({ hasText: 'Entrega' }).getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Calle de Proves 1' })).toBeVisible();
    await expect(page.locator('article').filter({ hasText: postalCode })).toHaveCount(1);
  });
});
