// US-12 · Confirmació de la reserva: de la cistella amb el lliurament a la reserva pendent amb el
// compte enrere del bloqueig; cancel·lar-la la torna a la cistella.
import { test, expect } from './fixtures.mjs';
import { eventDates } from './support/data.mjs';

const ALTAVOZ = { id: 'd0000000-0000-4000-8000-000000000001', name: 'Altavoz activo 12" 1300 W' };

test.describe('US-12 · Confirmació de la reserva', () => {
  test('el client confirma la cistella, veu el compte enrere i la pot cancel·lar', async ({ customer, productPage, cartPage, page, checkA11y }) => {
    const dates = eventDates(40 + test.info().parallelIndex);
    await productPage.goto(ALTAVOZ.id);
    await productPage.chooseDates(dates);
    await productPage.addToCart(1);
    await productPage.goToCart();
    await cartPage.fillAddress({ street: 'Calle de Proves 1', postalCode: '46001', city: 'Valencia' });
    await cartPage.chooseFirstSlot('Entrega');
    await cartPage.chooseFirstSlot('Recogida');
    await cartPage.saveDelivery.click();
    await expect(cartPage.readyForPayment).toBeVisible();
    await expect(cartPage.userName(customer.fullName)).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar reserva' }).click();
    await expect(page).toHaveURL(/\/reservas\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pendiente de pago' })).toBeVisible();
    await expect(page.getByRole('timer', { name: 'Tiempo restante para pagar' })).toHaveText(/^1[45]:\d\d$/);
    await expect(page.getByText(/^Reserva B4-\d{4}-\d{6}$/)).toBeVisible();
    await checkA11y('reserva pendent de pagament');

    await page.getByRole('button', { name: 'Cancelar y volver a mi reserva' }).click();
    await expect(page).toHaveURL(/\/reserva$/);
    await expect(cartPage.seller('Sonido Levante S.L.')).toContainText(ALTAVOZ.name);
  });
});
