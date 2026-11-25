/**
 * Serveis disponibles, acceptació i alta de riders (US-14). Un rider veu els serveis sense rider
 * de les reserves confirmades (sense dades personals del client) i n'accepta un; a partir d'aquí ja
 * veu l'adreça i el client. El perfil del rider i com veu un servei seu són als fonaments
 * (`riderRepository`).
 */
import { conflictError, notFoundError, validationError } from '../errors.js';
import { SERVICE, toService } from './riderRepository.js';

const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';

// El vehicle del rider ($1) pot fer el servei `d` si té almenys la capacitat (pes i volum) del
// vehicle que necessita. NULL = sense límit.
const FITS = `
  EXISTS (SELECT 1 FROM vehicle_types rv, vehicle_types sv
          WHERE rv.code = $1 AND sv.code = d.vehicle_type
            AND (rv.max_weight_kg IS NULL OR (sv.max_weight_kg IS NOT NULL AND rv.max_weight_kg >= sv.max_weight_kg))
            AND (rv.max_volume_m3 IS NULL OR (sv.max_volume_m3 IS NOT NULL AND rv.max_volume_m3 >= sv.max_volume_m3)))`;

// El rider ($2) ja té un altre servei actiu que se solapa amb el servei `d`.
const BUSY = `
  EXISTS (SELECT 1 FROM deliveries o
          WHERE o.rider_id = $2 AND o.id <> d.id AND o.status <> 'cancelled' AND o.time_window && d.time_window)`;

export function createAcceptanceRepository(pool) {
  return {
    /**
     * Serveis sense rider de reserves confirmades que encara no han començat, per ordre d'hora.
     * Cada servei diu si el vehicle del rider hi arriba (`fitsVehicle`) i si se solapa amb un
     * altre servei seu (`scheduleConflict`).
     */
    async availableServices({ userId, vehicleType }) {
      const { rows } = await pool.query(
        `SELECT q.*, ${FITS} AS fits, ${BUSY} AS busy
         FROM (${SERVICE}
               WHERE d.status = 'pending' AND e.status = 'confirmed' AND lower(d.time_window) > now()) q
         JOIN deliveries d ON d.id = q.id
         ORDER BY q.starts_at, q.delivery_type, q.seller_legal_name, q.id`,
        [vehicleType, userId],
      );
      return rows.map((row) => ({ ...toService(row, { personal: false }), fitsVehicle: row.fits, scheduleConflict: row.busy }));
    },

    /**
     * Assigna el servei al rider si encara està pendent. Si un altre rider l'ha acceptat abans
     * (o ja no està disponible), 409. Si ja era seu, el retorna igual. També 409 si el vehicle del
     * rider no hi arriba (`VEHICLE_TOO_SMALL`) o si té un altre servei a la mateixa hora
     * (`SCHEDULE_CONFLICT`).
     * @returns el servei amb les dades del client, que ara ja pot veure
     */
    async accept(serviceId, { userId: riderId, vehicleType }) {
      const check = await pool.query(`SELECT ${FITS} AS fits, ${BUSY} AS busy FROM deliveries d WHERE d.id = $3`, [vehicleType, riderId, serviceId]);
      if (check.rows[0] && !check.rows[0].fits) {
        throw conflictError('Tu vehículo no tiene capacidad suficiente para este servicio', { reason: 'VEHICLE_TOO_SMALL' });
      }
      if (check.rows[0]?.busy) {
        throw conflictError('Ya tienes otro servicio a esa hora', { reason: 'SCHEDULE_CONFLICT' });
      }
      let rows;
      try {
        ({ rows } = await pool.query(
        `UPDATE deliveries d SET status = 'assigned', rider_id = $2, assigned_at = now()
         FROM events e
         WHERE d.id = $1 AND d.status = 'pending' AND e.id = d.event_id AND e.status = 'confirmed'
           AND lower(d.time_window) > now()
         RETURNING d.id`,
          [serviceId, riderId],
        ));
      } catch (err) {
        // Dues acceptacions simultànies del mateix rider a la mateixa hora: la BD en rebutja una.
        if (err.code === EXCLUSION_VIOLATION) throw conflictError('Ya tienes otro servicio a esa hora', { reason: 'SCHEDULE_CONFLICT' });
        throw err;
      }
      if (!rows[0]) {
        const exists = await pool.query('SELECT rider_id FROM deliveries WHERE id = $1', [serviceId]);
        if (!exists.rows[0]) throw notFoundError('Servicio no encontrado');
        // Acceptar dues vegades el mateix servei (doble clic) no és un error.
        if (exists.rows[0].rider_id === riderId) return this.findAssigned(serviceId, riderId);
        throw conflictError('Este servicio ya no está disponible: otro repartidor lo ha aceptado', { reason: 'TAKEN' });
      }
      return this.findAssigned(serviceId, riderId);
    },

    /** Servei assignat al rider, amb les dades del client. null si no existeix o és d'un altre. */
    async findAssigned(serviceId, riderId) {
      const { rows } = await pool.query(`${SERVICE} WHERE d.id = $1 AND d.rider_id = $2`, [serviceId, riderId]);
      return rows[0] ? toService(rows[0], { personal: true }) : null;
    },

    /**
     * Un administrador dona el rol de rider a un usuari registrat i n'indica el vehicle.
     * @returns { userId, email, fullName, vehicleType }
     */
    async createRider(email, vehicleType) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT id, email, full_name, status FROM users WHERE email = $1 FOR UPDATE', [email]);
        const user = rows[0];
        if (!user) throw notFoundError('No hay ninguna cuenta con ese correo');
        if (user.status !== 'active') throw validationError('La cuenta tiene que estar verificada y activa', { field: 'email' });
        const vehicle = await client.query('SELECT 1 FROM vehicle_types WHERE code = $1', [vehicleType]);
        if (!vehicle.rows[0]) throw validationError('Vehículo no válido', { field: 'vehicleType' });
        await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'rider') ON CONFLICT DO NOTHING", [user.id]);
        try {
          await client.query('INSERT INTO riders (user_id, vehicle_type) VALUES ($1, $2)', [user.id, vehicleType]);
        } catch (err) {
          if (err.code === UNIQUE_VIOLATION) throw conflictError('Esta cuenta ya es de un repartidor');
          throw err;
        }
        await client.query('COMMIT');
        return { userId: user.id, email: user.email, fullName: user.full_name, vehicleType };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
