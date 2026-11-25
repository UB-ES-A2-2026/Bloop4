import { expect } from '@playwright/test';
import { BasePage } from './BasePage.mjs';

/** Cistella de la reserva (/reserva): línies per venedor, totals i formulari d'entrega i recollida. */
export class CartPage extends BasePage {
  constructor(page) {
    super(page);
    this.delivery = page.getByRole('form', { name: 'Entrega y recogida' });
    this.saveDelivery = this.delivery.getByRole('button', { name: /^(Guardar|Actualizar) entrega$/ });
    this.readyForPayment = this.status('Tu reserva está lista para el pago');
  }

  async goto() {
    await this.page.goto('/reserva');
    await expect(this.heading).toHaveText('Mi reserva');
  }

  /** Bloc d'un venedor (secció amb el nom de l'empresa). */
  seller(legalName) {
    return this.page.getByRole('region', { name: legalName });
  }

  line(productName) {
    return this.page.getByRole('listitem').filter({ hasText: productName });
  }

  /** Valor d'un total del resum («Alquiler», «Transporte», «Total a pagar»). */
  total(label) {
    return this.page.locator('dt', { hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]');
  }

  async fillAddress({ street, postalCode, city }) {
    await this.delivery.getByLabel('Dirección del evento').fill(street);
    await this.delivery.getByLabel('Código postal').fill(postalCode);
    await this.delivery.getByLabel('Ciudad').fill(city);
  }

  /** Tria la primera franja disponible del grup «Entrega» o «Recogida». */
  async chooseFirstSlot(group) {
    const slot = this.delivery.getByRole('radiogroup', { name: group }).getByRole('radio').and(this.page.locator(':enabled')).first();
    await slot.click();
    await expect(slot).toHaveAttribute('aria-checked', 'true');
    return slot.textContent();
  }
}
