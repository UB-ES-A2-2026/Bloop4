/** Client de les rutes /api/cart (cistella de reserva del client). */
import { request } from './http';

export async function fetchCart({ signal } = {}) {
  const { data } = await request('/cart', { signal, shape: 'object' });
  return data;
}

/** Crea la cistella o en canvia les dates (Date). */
export async function setCartDates({ from, to }) {
  const body = { startsAt: from.toISOString(), endsAt: to.toISOString() };
  const { data } = await request('/cart', { method: 'PUT', body, shape: 'object' });
  return data;
}

export async function addCartItem(productId, quantity) {
  const { data } = await request('/cart/items', { method: 'POST', body: { productId, quantity }, shape: 'object' });
  return data;
}

/** Deixa la línia amb `quantity` unitats (i n'accepta el preu actual). */
export async function updateCartItem(itemId, quantity) {
  const { data } = await request(`/cart/items/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: { quantity }, shape: 'object' });
  return data;
}

export function removeCartItem(itemId) {
  return request(`/cart/items/${encodeURIComponent(itemId)}`, { method: 'DELETE', shape: 'none' });
}
