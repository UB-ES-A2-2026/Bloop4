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

/** Inicia (o reprèn) el pagament d'una reserva pendent: { status, amount, currency, checkoutUrl }. */
export async function startPayment(id) {
  const { data } = await request(`/bookings/${encodeURIComponent(id)}/payment`, { method: 'POST', shape: 'object' });
  return data;
}

/** Estat del pagament i de la fiança d'una reserva. */
export async function fetchPayment(id, { signal } = {}) {
  const { data } = await request(`/bookings/${encodeURIComponent(id)}/payment`, { signal, shape: 'object' });
  return data;
}

/** Passarel·la simulada (desenvolupament): «paga» la sessió `ref` amb una targeta de prova. */
export async function completeMockPayment(ref, cardNumber) {
  const { data } = await request('/payments/mock/complete', { method: 'POST', body: { ref, cardNumber }, shape: 'object' });
  return data;
}

/** Seguiment dels lliuraments i recollides d'una reserva. */
export async function fetchTracking(id, { signal } = {}) {
  const { data } = await request(`/bookings/${encodeURIComponent(id)}/tracking`, { signal, shape: 'object' });
  return data;
}

/** Lliuraments en curs de la reserva amb l'última posició del rider. */
export async function fetchLocations(id, { signal } = {}) {
  const { data } = await request(`/bookings/${encodeURIComponent(id)}/locations`, { signal });
  return data;
}
