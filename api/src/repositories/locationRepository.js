/**
 * Ubicació del rider durant un lliurament (US-16). Només es guarda l'última posició de cada
 * lliurament en curs; la BD l'esborra quan el lliurament acaba.
 */
import { conflictError, notFoundError, tooManyRequestsError } from '../errors.js';

// El navegador del rider envia la posició cada 10 s; més sovint no aporta res.
export const MIN_INTERVAL_SECONDS = 5;
// Una posició de fa més de 2 minuts es mostra com a antiga.
export const STALE_AFTER_SECONDS = 120;

export function createLocationRepository(pool) {
  return {
    /** Desa la posició del rider per a un lliurament seu en curs. */
    async record(serviceId, riderId, { latitude, longitude, accuracy }) {
      const { rows } = await pool.query(
        `SELECT d.status, d.delivery_type,
                (SELECT extract(epoch FROM now() - l.recorded_at) FROM rider_locations l WHERE l.delivery_id = d.id) AS seconds_since
         FROM deliveries d WHERE d.id = $1 AND d.rider_id = $2`,
        [serviceId, riderId],
      );
      const service = rows[0];
      if (!service) throw notFoundError('Servicio no encontrado');
      if (service.delivery_type !== 'delivery') {
        throw conflictError('La ubicación solo se comparte durante las entregas', { reason: 'NOT_A_DELIVERY' });
      }
      if (service.status !== 'in_transit') {
        throw conflictError('La ubicación solo se comparte mientras la entrega está en curso', { reason: 'NOT_IN_TRANSIT' });
      }
      if (service.seconds_since !== null && Number(service.seconds_since) < MIN_INTERVAL_SECONDS) {
        throw tooManyRequestsError('Estás enviando la ubicación demasiado a menudo', Math.ceil(MIN_INTERVAL_SECONDS - Number(service.seconds_since)));
      }
      await pool.query(
        `INSERT INTO rider_locations (delivery_id, rider_id, latitude, longitude, accuracy_m, recorded_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (delivery_id) DO UPDATE
         SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy_m = EXCLUDED.accuracy_m, recorded_at = now()`,
        [serviceId, riderId, latitude, longitude, accuracy],
      );
    },
  };
}
