/**
 * Llista de serveis del rider (US-15): els lliuraments i recollides que té assignats cada dia, amb
 * l'adreça i el material. Un rider només veu els seus serveis. El detall d'un servei
 * (`riderRepository.findMine`) és als fonaments: el fan servir també el seguiment i les proves.
 */
import { MY_SERVICES, toMyService } from './riderRepository.js';

export function createRiderScheduleRepository(pool) {
  return {
    /** Serveis del rider d'un dia ('AAAA-MM-DD', hora de Madrid), per ordre d'hora. */
    async servicesOn(riderId, date) {
      const { rows } = await pool.query(
        `${MY_SERVICES}
           AND d.time_window && tstzrange(($2::date)::timestamp AT TIME ZONE 'Europe/Madrid',
                                          ($2::date + 1)::timestamp AT TIME ZONE 'Europe/Madrid', '[)')
         ORDER BY lower(d.time_window), d.delivery_type, d.id`,
        [riderId, date],
      );
      return rows.map(toMyService);
    },

    /** Propers serveis actius del rider (a partir d'ara), per ordre d'hora. */
    async upcoming(riderId, limit = 50) {
      const { rows } = await pool.query(
        `${MY_SERVICES} AND upper(d.time_window) > now() AND d.status IN ('assigned', 'in_transit')
         ORDER BY lower(d.time_window), d.id LIMIT $2`,
        [riderId, limit],
      );
      return rows.map(toMyService);
    },
  };
}
