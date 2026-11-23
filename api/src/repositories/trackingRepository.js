/**
 * Seguiment dels serveis d'una reserva (US-09): estat de cada lliurament i recollida, historial i
 * retards, i els canvis d'estat que fa el rider. Les transicions es validen a `tracking/transitions.js`.
 */
import { conflictError, notFoundError } from '../errors.js';
import { canTransition, phaseOf } from '../tracking/transitions.js';

const SERVICES = `
  SELECT d.id, d.delivery_type, d.status, d.seller_id, s.legal_name, s.city AS seller_city,
         lower(d.time_window) AS starts_at, upper(d.time_window) AS ends_at,
         -- Retard: la franja ja ha acabat i el servei encara no s'ha completat.
         (upper(d.time_window) < now() AND d.status IN ('pending', 'assigned', 'in_transit')) AS delayed,
         (SELECT coalesce(json_agg(json_build_object(
                   'status', h.status,
                   'at', to_char(h.changed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY h.changed_at, h.id), '[]')
          FROM delivery_status_history h WHERE h.delivery_id = d.id) AS history
  FROM deliveries d JOIN sellers s ON s.id = d.seller_id
  WHERE d.event_id = $1
  ORDER BY s.legal_name, s.id, d.delivery_type DESC`;

function toTrackedService(row) {
  return {
    id: row.id,
    type: row.delivery_type,
    status: row.status,
    timeWindow: { startsAt: row.starts_at, endsAt: row.ends_at },
    delayed: row.delayed,
    history: row.history,
  };
}

export function createTrackingRepository(pool) {
  return {
    /** Serveis de la reserva agrupats per venedor, amb la fase de cadascun. */
    async tracking(eventId) {
      const { rows } = await pool.query(SERVICES, [eventId]);
      const sellers = [];
      for (const row of rows) {
        let group = sellers.at(-1);
        if (group?.seller.id !== row.seller_id) {
          group = { seller: { id: row.seller_id, legalName: row.legal_name, city: row.seller_city }, delivery: null, pickup: null };
          sellers.push(group);
        }
        group[row.delivery_type === 'delivery' ? 'delivery' : 'pickup'] = toTrackedService(row);
      }
      return sellers.map((group) => ({ ...group, phase: phaseOf(group) }));
    },

    /**
     * Canvia l'estat d'un servei del rider de `from` a `to`. 404 si no és seu; 409 si l'estat ja
     * no és `from` o la transició no està permesa.
     */
    async transition(serviceId, riderId, { from, to }, client = pool) {
      if (!canTransition(from, to)) throw conflictError('Este cambio de estado no está permitido', { reason: 'INVALID_TRANSITION' });
      const { rows } = await client.query(
        'UPDATE deliveries SET status = $4 WHERE id = $1 AND rider_id = $2 AND status = $3 RETURNING id',
        [serviceId, riderId, from, to],
      );
      if (rows[0]) return;
      const current = await client.query('SELECT status, rider_id FROM deliveries WHERE id = $1', [serviceId]);
      if (!current.rows[0] || current.rows[0].rider_id !== riderId) throw notFoundError('Servicio no encontrado');
      throw conflictError('Este servicio ya no está en el estado esperado. Actualiza la página', {
        reason: 'INVALID_TRANSITION',
        status: current.rows[0].status,
      });
    },

    /**
     * El rider inicia un servei seu (assigned → in_transit). Una recollida no es pot iniciar fins
     * que s'ha fet el lliurament del mateix venedor.
     */
    async start(serviceId, riderId) {
      const { rows } = await pool.query(
        `SELECT d.delivery_type,
                (SELECT o.status FROM deliveries o
                 WHERE o.event_id = d.event_id AND o.seller_id = d.seller_id AND o.delivery_type = 'delivery') AS delivery_status
         FROM deliveries d WHERE d.id = $1 AND d.rider_id = $2`,
        [serviceId, riderId],
      );
      if (!rows[0]) throw notFoundError('Servicio no encontrado');
      if (rows[0].delivery_type === 'pickup' && rows[0].delivery_status !== 'delivered') {
        throw conflictError('La recogida no puede empezar antes de que se complete la entrega', { reason: 'DELIVERY_NOT_DONE' });
      }
      await this.transition(serviceId, riderId, { from: 'assigned', to: 'in_transit' });
    },
  };
}
