// Fixtures de les proves E2E: els objectes de pàgina, un client nou ja verificat i l'anàlisi
// d'accessibilitat. Les proves importen `test` i `expect` d'aquí, no de @playwright/test.
import { test as base, expect } from '@playwright/test';
import { createVerifiedCustomer, signIn } from './support/accounts.mjs';
import { checkA11y } from './support/a11y.mjs';
import { LoginPage, RegisterPage } from './pages/AuthPages.mjs';
import { CartPage } from './pages/CartPage.mjs';
import { CatalogPage } from './pages/CatalogPage.mjs';
import { ProductPage } from './pages/ProductPage.mjs';
import { SellerHomePage, SellerProductFormPage } from './pages/SellerPages.mjs';

export const test = base.extend({
  catalogPage: async ({ page }, use) => use(new CatalogPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  sellerHomePage: async ({ page }, use) => use(new SellerHomePage(page)),
  sellerProductFormPage: async ({ page }, use) => use(new SellerProductFormPage(page)),

  /** Client nou, registrat i verificat per l'API, amb la sessió iniciada al navegador. */
  customer: async ({ page, request }, use) => {
    const customer = await createVerifiedCustomer(request);
    await signIn(page, customer);
    await use(customer);
  },

  /** `await checkA11y('nom de la pantalla')` analitza la pàgina oberta amb axe. */
  checkA11y: async ({ page }, use, testInfo) => {
    await use((screen) => checkA11y(page, testInfo, screen));
  },
});

export { expect };
