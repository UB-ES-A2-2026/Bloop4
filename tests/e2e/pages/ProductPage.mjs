import { BasePage } from './BasePage.mjs';

/** Fitxa d'un producte (/productos/:id): dades, disponibilitat i «Añadir a la reserva». */
export class ProductPage extends BasePage {
  constructor(page) {
    super(page);
    this.specs = page.getByRole('heading', { name: 'Especificaciones' });
    this.startInput = page.getByLabel('Inicio del evento');
    this.endInput = page.getByLabel('Fin del evento');
    this.available = this.status(/^Disponible \(\d+ unidades?\)/);
    this.quantityInput = page.getByLabel('Cantidad');
    this.addButton = page.getByRole('button', { name: 'Añadir a la reserva' });
    this.added = this.status('Añadido a tu reserva');
  }

  async goto(productId) {
    await this.page.goto(`/productos/${productId}`);
  }

  /** `from` i `to` en el format dels camps datetime-local: '2031-07-10T12:00'. */
  async chooseDates({ from, to }) {
    await this.startInput.fill(from);
    await this.endInput.fill(to);
  }

  async addToCart(quantity) {
    await this.quantityInput.fill(String(quantity));
    await this.addButton.click();
  }

  async goToCart() {
    await this.added.getByRole('link', { name: 'Ver la reserva' }).click();
  }
}
