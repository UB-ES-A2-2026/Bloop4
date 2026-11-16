import { expect } from '@playwright/test';
import { BasePage } from './BasePage.mjs';

/** Panell del venedor (/vendedor): llista dels seus productes. */
export class SellerHomePage extends BasePage {
  constructor(page) {
    super(page);
    this.newProduct = page.getByRole('link', { name: 'Nuevo producto' });
  }

  async goto() {
    await this.page.goto('/vendedor');
  }

  product(name) {
    return this.page.getByRole('link', { name });
  }
}

/** Formulari de producte del venedor (/vendedor/productos/nuevo i /vendedor/productos/:id). */
export class SellerProductFormPage extends BasePage {
  constructor(page) {
    super(page);
    this.statusBadge = this.heading.locator('.badge');
    // El nom accessible d'un <select> dins d'una etiqueta inclou l'opció triada («Categoría Sillas»).
    this.category = page.getByRole('combobox', { name: /^Categoría/ });
    this.saveDraft = page.getByRole('button', { name: 'Guardar borrador' });
    this.publishButton = page.getByRole('button', { name: 'Publicar' });
    this.photos = page.getByRole('list', { name: 'Fotos del producto' }).getByRole('listitem');
  }

  async gotoNew() {
    await this.page.goto('/vendedor/productos/nuevo');
    await expect(this.heading).toBeVisible();
  }

  /** Omple el formulari: `category` és el nom de la subcategoria; la resta, etiqueta → valor. */
  async fill({ category, ...fields }) {
    if (category) await this.category.selectOption({ label: category });
    for (const [label, value] of Object.entries(fields)) {
      await this.page.getByLabel(label, { exact: true }).fill(String(value));
    }
  }

  /** Puja una foto ({ name, mimeType, buffer }) i espera que surti a la llista. */
  async uploadPhoto(file) {
    const before = await this.photos.count();
    await this.page.getByLabel('Añadir fotos').setInputFiles(file);
    await expect(this.photos).toHaveCount(before + 1);
  }

  async publish() {
    await this.publishButton.click();
  }
}
