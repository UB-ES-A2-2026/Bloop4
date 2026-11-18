/** Client de les rutes de reserves: checkout de la cistella i /api/bookings. */
import { request } from './http';

/**
 * Converteix la cistella en una reserva pendent de pagament. `idempotencyKey` identifica
 * l'intent: repetir la crida amb la mateixa clau no crea una altra reserva.
 */
export async function checkoutCart(idempotencyKey) {
  const { data } = await request('/cart/checkout', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    shape: 'object',
  });
  return data;
}

export async function fetchBookings({ signal } = {}) {
  const { data } = await request('/bookings', { signal });
  return data;
}

export async function fetchBooking(id, { signal } = {}) {
  const { data } = await request(`/bookings/${encodeURIComponent(id)}`, { signal, shape: 'object' });
  return data;
}

/** Renuncia a una reserva pendent de pagament: torna a ser la cistella. */
export function cancelBooking(id) {
  return request(`/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST', shape: 'none' });
}
