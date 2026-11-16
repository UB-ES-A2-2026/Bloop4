// Registre amb verificació per correu, inici i tancament de sessió, i rutes protegides per rol.
import { test, expect } from './fixtures.mjs';
import { newCustomerData, SEED_SELLER } from './support/accounts.mjs';
import { verificationLink } from './support/mailpit.mjs';

test.describe('US-13 · Registre i accés amb rol', () => {
  test('una persona es registra, verifica el correu i inicia la sessió', async ({ page, request, registerPage, loginPage, checkA11y }) => {
    const customer = newCustomerData('registre');

    await registerPage.goto();
    await checkA11y('registre');
    await registerPage.registerCustomer(customer);
    await expect(registerPage.heading).toHaveText('Revisa tu correo');

    // L'enllaç arriba per correu (Mailpit) i activa el compte.
    await page.goto(await verificationLink(request, customer.email));
    await expect(registerPage.status('Correo verificado. Ya puedes iniciar sesión.')).toBeVisible();

    await loginPage.goto();
    await checkA11y('inici de sessió');
    await loginPage.signIn(customer);
    await expect(loginPage.userName(customer.fullName)).toBeVisible();

    await loginPage.signOut();
    await expect(loginPage.nav.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('una contrasenya incorrecta no obre la sessió', async ({ loginPage }) => {
    // Correu que no existeix: un intent fallit amb un compte real el podria bloquejar 15 minuts.
    await loginPage.goto();
    await loginPage.signIn({ email: newCustomerData('no-existeix').email, password: 'no-es-aquesta' });
    await expect(loginPage.page.getByRole('alert')).toBeVisible();
    await expect(loginPage.nav.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('sense sessió, la reserva porta a iniciar la sessió', async ({ page, loginPage }) => {
    await page.goto('/reserva');
    await expect(page).toHaveURL(/\/iniciar-sesion$/);
    await expect(loginPage.heading).toHaveText('Iniciar sesión');
  });

  test('un client no pot entrar al panell del venedor', async ({ page, loginPage, customer }) => {
    await page.goto('/vendedor');
    await expect(loginPage.userName(customer.fullName)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('No tienes acceso a esta página');
  });

  test('un venedor que inicia la sessió va al seu panell', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(SEED_SELLER);
    await expect(page).toHaveURL(/\/vendedor$/);
    await expect(loginPage.heading).toHaveText(SEED_SELLER.legalName);
  });
});
