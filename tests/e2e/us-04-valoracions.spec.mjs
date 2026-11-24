// US-04 · Valoracions: un client amb una reserva finalitzada valora un producte i la valoració surt a
// la fitxa amb la mitjana. La reserva finalitzada es prepara amb SQL.
import { test, expect } from './fixtures.mjs';
import { eventDates } from './support/data.mjs';
import { canUseDatabase } from './support/db.mjs';
import { PRODUCTS, createBooking, userId } from './support/states.mjs';

test.describe('US-04 · Valoracions de productes', () => {
  test.skip(!canUseDatabase, 'Necessita la base de dades del stack de proves');

  test('un client amb la reserva finalitzada valora el producte', async ({ customer, page, checkA11y }) => {
    const comment = `Muy buen sonido (${Date.now()})`;
    createBooking({ customerId: userId(customer.email), day: eventDates(-500 - test.info().parallelIndex).day, status: 'completed', items: [{ product: PRODUCTS.micro, quantity: 1 }] });

    await page.goto(`/productos/${PRODUCTS.micro.id}`);
    const form = page.getByRole('form', { name: 'Valora este producto' });
    await expect(form).toBeVisible();
    await checkA11y('formulari de valoració');
    // Com una persona: es clica l'estrella (l'etiqueta del botó d'opció, que és amagat).
    await form.locator('label').filter({ has: page.getByRole('radio', { name: '4 estrellas' }) }).click();
    await expect(form.getByRole('radio', { name: '4 estrellas' })).toBeChecked();
    await form.getByLabel('Comentario (opcional)').fill(comment);
    await form.getByRole('button', { name: 'Publicar valoración' }).click();

    const reviews = page.getByRole('region', { name: 'Valoraciones' });
    await expect(reviews.getByText(comment)).toBeVisible();
    await expect(reviews.getByText(/\d+ valoraci(ón|ones)/)).toBeVisible();
    await expect(page.getByRole('form', { name: 'Valora este producto' })).toHaveCount(0);
  });
});
