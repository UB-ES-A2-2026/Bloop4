/**
 * Serveis disponibles, acceptació i alta de riders (US-14). Un rider veu els serveis sense rider
 * de les reserves confirmades (sense dades personals del client) i n'accepta un; a partir d'aquí ja
 * veu l'adreça i el client. El perfil del rider i com veu un servei seu són als fonaments
 * (`riderRepository`).
 */
import { conflictError, notFoundError, validationError } from '../errors.js';
import { SERVICE, toService } from './riderRepository.js';

const UNIQUE_VIOLATION = '23505';

export function createAcceptanceRepository(pool) {
  return {
    /** Serveis sense rider de reserves confirmades que encara no han començat, per ordre d'hora. */
    async availableServices() {
      const { rows } = await pool.query(
        `${SERVICE}
         WHERE d.status = 'pending' AND e.status = 'confirmed' AND lower(d.time_window) > now()
         ORDER BY lower(d.time_window), d.delivery_type, s.legal_name, d.id`,
      );
      return rows.map((row) => toService(row, { personal: false }));
    },

    /**
     * Assigna el servei al rider si encara està pendent. Si un altre rider l'ha acceptat abans
     * (o ja no està disponible), 409. Si ja era seu, el retorna igual.
     * @returns el servei amb les dades del client, que ara ja pot veure
     */
    async accept(serviceId, riderId) {
      const { rows } = await pool.query(
        `UPDATE deliveries d SET status = 'assigned', rider_id = $2, assigned_at = now()
         FROM events e
         WHERE d.id = $1 AND d.status = 'pending' AND e.id = d.event_id AND e.status = 'confirmed'
           AND lower(d.time_window) > now()
         RETURNING d.id`,
        [serviceId, riderId],
      );
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
