// Camí del client fins que la reserva és a punt per pagar: disponibilitat, cistella i lliurament.
import { test, expect } from './fixtures.mjs';
import { eventDates } from './support/data.mjs';

const ALTAVOZ = { id: 'd0000000-0000-4000-8000-000000000001', name: 'Altavoz activo 12" 1300 W', seller: 'Sonido Levante S.L.' };

test.describe('US-05 · US-06 · US-07 · Disponibilitat, cistella i lliurament', () => {
  test('un client consulta la disponibilitat, afegeix un producte i tria l\'entrega i la recogida', async ({
    customer,
    productPage,
    cartPage,
    checkA11y,
  }) => {
    const dates = eventDates(test.info().parallelIndex);

    // US-05: disponibilitat i preu de l'interval.
    await productPage.goto(ALTAVOZ.id);
    await productPage.chooseDates(dates);
    await expect(productPage.available).toBeVisible();

    // US-06: la línia va a la cistella, agrupada per venedor.
    await productPage.addToCart(2);
    await expect(productPage.added).toBeVisible();
    await productPage.goToCart();
    await expect(cartPage.seller(ALTAVOZ.seller)).toContainText(ALTAVOZ.name);
    await expect(cartPage.total('Total a pagar')).toHaveText(/\d+(,\d{2})?\s*€/);
    await expect(cartPage.userName(customer.fullName)).toBeVisible();
    await checkA11y('cistella');

    // US-07: adreça dins de la zona de repartiment i franges compatibles amb l'esdeveniment.
    await cartPage.fillAddress({ street: 'Calle de Proves 1', postalCode: '46001', city: 'Valencia' });
    await cartPage.chooseFirstSlot('Entrega');
    await cartPage.chooseFirstSlot('Recogida');
    await cartPage.saveDelivery.click();
    await expect(cartPage.readyForPayment).toBeVisible();
    await expect(cartPage.total('Transporte')).toHaveText(/\d+(,\d{2})?\s*€/);
  });

  test('un codi postal fora de la zona de repartiment no deixa triar franges', async ({ customer, productPage, cartPage }) => {
    const dates = eventDates(10 + test.info().parallelIndex);
    await productPage.goto(ALTAVOZ.id);
    await productPage.chooseDates(dates);
    await productPage.addToCart(1);
    await productPage.goToCart();
    await expect(cartPage.userName(customer.fullName)).toBeVisible();

    await cartPage.fillAddress({ street: 'Carrer de Proves 1', postalCode: '08001', city: 'Barcelona' });
    await expect(cartPage.delivery.getByRole('alert').first()).toBeVisible();
    await expect(cartPage.delivery.getByRole('radiogroup', { name: 'Entrega' })).toHaveCount(0);
  });
});
