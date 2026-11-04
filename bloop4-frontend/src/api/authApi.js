/** Client de les rutes /api/auth. La sessió viatja en una cookie httpOnly. */
import { request } from './http';

/** @returns {Promise<string>} el missatge de l'API per mostrar a l'usuari */
export async function register(form) {
  const { data } = await request('/auth/register', { method: 'POST', body: form, shape: 'object' });
  return data.message;
}

/** @returns {Promise<object>} l'usuari amb { id, email, fullName, status, roles, seller } */
export async function login({ email, password }) {
  const { data } = await request('/auth/login', { method: 'POST', body: { email, password }, shape: 'object' });
  return data;
}

export function logout() {
  return request('/auth/logout', { method: 'POST', shape: 'none' });
}

/** @returns {Promise<object | null>} l'usuari de la sessió o null si no n'hi ha */
export async function fetchMe({ signal } = {}) {
  try {
    const { data } = await request('/auth/me', { signal, shape: 'object' });
    return data;
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

/** Afegeix el rol de venedor al compte de la sessió. @returns l'usuari actualitzat */
export async function becomeSeller({ legalName, city }) {
  const { data } = await request('/auth/become-seller', { method: 'POST', body: { legalName, city }, shape: 'object' });
  return data;
}

export async function verifyEmail(token) {
  const { data } = await request('/auth/verify-email', { method: 'POST', body: { token }, shape: 'object' });
  return data.message;
}

export async function resendVerification(email) {
  const { data } = await request('/auth/resend-verification', { method: 'POST', body: { email }, shape: 'object' });
  return data.message;
}
