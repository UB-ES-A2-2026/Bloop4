// US-08 · Pagament amb la passarel·la simulada: una targeta rebutjada no cobra i es pot tornar a
// provar; la targeta de prova 4242 confirma la reserva i en dona el comprovant. La reserva pendent es
// prepara amb SQL (com la deixaria el checkout de US-12).
import { test, expect } from './fixtures.mjs';
import { eventDates } from './support/data.mjs';
import { canUseDatabase } from './support/db.mjs';
import { createBooking, userId } from './support/states.mjs';

test.describe('US-08 · Pagament de la reserva', () => {
  test.skip(!canUseDatabase, 'Necessita la base de dades del stack de proves');

  test('una targeta rebutjada no cobra; amb la de prova la reserva queda confirmada', async ({ customer, page, checkA11y }) => {
    const booking = createBooking({ customerId: userId(customer.email), day: eventDates(50 + test.info().parallelIndex).day, status: 'pending_payment' });
    await page.goto(`/reservas/${booking.eventId}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Pendiente de pago' })).toBeVisible();

    await page.getByRole('button', { name: 'Pagar con tarjeta' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pago simulado' })).toBeVisible();
    await checkA11y('pagament simulat');
    await page.getByLabel('Tarjeta de prueba').fill('4000 0000 0000 0002');
    await page.getByRole('button', { name: 'Pagar', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('La tarjeta ha sido rechazada');
    await page.getByRole('link', { name: 'Cancelar y volver a la reserva' }).click();

    await page.getByRole('button', { name: 'Reintentar el pago' }).click();
    await page.getByLabel('Tarjeta de prueba').fill('4242 4242 4242 4242');
    await page.getByRole('button', { name: 'Pagar', exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/reservas/${booking.eventId}\\?pago=ok`));
    await expect(page.getByRole('heading', { level: 1, name: 'Confirmada' })).toBeVisible();
    await expect(page.getByText('Comprobante', { exact: true })).toBeVisible();
    await expect(page.getByText(/^R-\d{4}-\d{6}$/)).toBeVisible();
    await checkA11y('reserva pagada');
  });
});
