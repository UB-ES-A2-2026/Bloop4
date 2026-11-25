/**
 * Punts d'extensió entre les històries del Sprint 2. Una història avisa d'un fet (`emit`) i les
 * altres hi reaccionen si hi són (`on`): així cap història no importa codi d'una altra i cadascuna
 * pot arribar a `dev` en qualsevol ordre. Si ningú no escolta un fet, no passa res.
 *
 * Fets que hi ha (qui l'emet → qui hi reacciona):
 * - `beforeBookingRead(customerId)`: abans de llegir una reserva del client (fonaments) → US-12
 *   allibera els bloquejos caducats d'aquell client.
 * - `bookingConfirmed({ booking, sellers })`: una reserva pendent passa a confirmada (fonaments, quan
 *   US-08 rep el pagament) → US-12 avisa els venedors per correu.
 * - `serviceStatusChanged(serviceId)`: un servei canvia d'estat (US-09, US-11) → US-09 avisa el client.
 * - `bookingSettled(eventId)`: totes les recollides fetes i cap incidència oberta (US-11) → US-08
 *   allibera la fiança.
 *
 * Els gestors s'executen en ordre i un error es propaga a qui ha emès el fet: si un gestor no ha
 * de fer fallar l'operació (un correu, un avís), l'ha de capturar ell mateix.
 */
export function createHooks() {
  const handlers = new Map();
  return {
    on(name, handler) {
      if (typeof handler !== 'function') throw new TypeError(`El gestor de «${name}» ha de ser una funció`);
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    },

    async emit(name, ...args) {
      for (const handler of handlers.get(name) ?? []) await handler(...args);
    },

    /** Si algú escolta el fet `name`. */
    has(name) {
      return (handlers.get(name)?.length ?? 0) > 0;
    },
  };
}
