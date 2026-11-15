import { expect } from '@playwright/test';
import { BasePage } from './BasePage.mjs';

/** Catàleg (/): cerca, filtre per categories i graella de productes. */
export class CatalogPage extends BasePage {
  constructor(page) {
    super(page);
    this.searchBox = page.getByRole('searchbox', { name: 'Buscar productos' });
    this.products = page.getByRole('list', { name: 'Productos' }).getByRole('listitem');
    this.resultsCount = page.getByRole('status').filter({ hasText: /\d+ productos?$/ });
  }

  async goto(query = '') {
    await this.page.goto(`/${query}`);
    await expect(this.products.first()).toBeVisible();
  }

  /** Escriu la cerca; el catàleg la fa servir després del debounce. */
  async search(text) {
    await this.searchBox.fill(text);
  }

  /** Marca o desmarca una categoria del filtre («Sonido», «Sillas»...). */
  async toggleCategory(name) {
    await this.page.getByRole('checkbox', { name: new RegExp(`^${name}\\b`) }).click();
  }

  card(productName) {
    return this.products.filter({ has: this.page.getByRole('heading', { name: productName, exact: true }) });
  }

  async openProduct(productName) {
    await this.card(productName).getByRole('link').click();
  }
}
