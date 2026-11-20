/** Textos i utilitats de les reserves. */

export const BOOKING_STATUS_LABEL = {
  pending_payment: 'Pendiente de pago',
  confirmed: 'Confirmada',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
};

/** Segons → "14:05" (minuts:segons). Mai negatiu. */
export function formatCountdown(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/** Clau d'idempotència per a un intent de checkout. */
export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
