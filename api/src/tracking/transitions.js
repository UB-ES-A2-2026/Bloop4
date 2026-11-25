/**
 * Estats d'un servei (lliurament o recollida) i transicions permeses. La BD guarda l'estat i
 * l'historial; quines transicions es poden fer ho decideix l'API (decisió del Sprint 1).
 *
 *   pending ──(rider accepta)──▶ assigned ──(rider inicia)──▶ in_transit ──▶ delivered
 *      │                            │                            └────────▶ incident
 *      └──────────────▶ cancelled ◀─┘
 */
export const TRANSITIONS = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'incident'],
  delivered: [],
  incident: [],
  cancelled: [],
};

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

/**
 * Fase de cada venedor d'una reserva tal com la veu el client, a partir de l'estat del seu
 * lliurament i de la seva recollida.
 * @returns 'confirmed' | 'delivery_in_transit' | 'delivered' | 'pickup_in_transit' | 'picked_up' | 'incident' | 'cancelled'
 */
export function phaseOf({ delivery, pickup }) {
  const statuses = [delivery?.status, pickup?.status];
  if (statuses.includes('incident')) return 'incident';
  if (statuses.every((s) => s === 'cancelled')) return 'cancelled';
  if (pickup?.status === 'delivered') return 'picked_up';
  if (pickup?.status === 'in_transit') return 'pickup_in_transit';
  if (delivery?.status === 'delivered') return 'delivered';
  if (delivery?.status === 'in_transit') return 'delivery_in_transit';
  return 'confirmed';
}
