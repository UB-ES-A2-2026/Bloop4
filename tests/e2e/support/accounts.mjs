// Comptes per a les proves. Cada prova que modifica dades fa servir un client nou, perquè les
// proves es puguin executar en paral·lel i tantes vegades com calgui sobre el mateix stack.
import { expect } from '@playwright/test';
import { SEED_PASSWORD } from './env.mjs';
import { verificationLink } from './mailpit.mjs';

/** Venedor verificat dels seeds (Mobiliario Eventos Turia S.L.). */
export const SEED_SELLER = { email: 'mobiliario@example.com', password: SEED_PASSWORD, legalName: 'Mobiliario Eventos Turia S.L.' };

let counter = 0;
/** Dades d'un client nou amb un correu únic (@example.com, mai real). */
export function newCustomerData(prefix = 'e2e') {
  const id = `${Date.now().toString(36)}${process.pid}${++counter}`;
  return { email: `${prefix}-${id}@example.com`, password: 'Contrasenya-e2e-1', fullName: `Client E2E ${id}` };
}

/**
 * Crea un client per l'API i el verifica amb l'enllaç del correu (com faria la persona).
 * `request` ha de ser el d'un context sense sessió (p. ex. el fixture `request`).
 */
export async function createVerifiedCustomer(request) {
  const customer = newCustomerData();
  const registered = await request.post('/api/auth/register', {
    data: { ...customer, role: 'customer', acceptTerms: true },
  });
  expect(registered.status(), 'Registre del client de prova').toBe(201);
  const token = new URL(await verificationLink(request, customer.email)).searchParams.get('token');
  const verified = await request.post('/api/auth/verify-email', { data: { token } });
  expect(verified.ok(), 'Verificació del client de prova').toBeTruthy();
  return customer;
}

/** Inicia la sessió per l'API dins del context de la pàgina (la cookie queda al navegador). */
export async function signIn(page, { email, password }) {
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(response.status(), `Inici de sessió de ${email}`).toBe(200);
}
