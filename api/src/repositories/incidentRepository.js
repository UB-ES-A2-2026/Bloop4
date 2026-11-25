/**
 * Incidències dels serveis (US-11) i tancament de la reserva: quan totes les recollides s'han fet,
 * la reserva queda 'completed', i la fiança només s'allibera si no hi ha cap incidència oberta.
 */
import { conflictError, notFoundError, validationError } from '../errors.js';

async function inTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function toIncident(row) {
  return {
    id: row.id,
    serviceId: row.delivery_id,
    kind: row.kind,
    description: row.description,
    photoUrl: row.photo_id ? `/api/proofs/photos/${row.photo_id}` : null,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    ...(row.booking_number ? { bookingNumber: row.booking_number, type: row.delivery_type, seller: { legalName: row.legal_name } } : {}),
  };
}

export function createIncidentRepository(pool) {
  return {
    /** Incidència d'un servei completat amb material danyat o que falta. */
    async createFromChecklist(serviceId, problems) {
      const kind = problems.some((p) => p.condition === 'damaged') ? 'damaged' : 'missing';
      const description = problems.map((p) => `${p.name}: ${p.note}`).join('\n');
      const { rows } = await pool.query('INSERT INTO incidents (delivery_id, kind, description) VALUES ($1, $2, $3) RETURNING *', [
        serviceId,
        kind,
        description,
      ]);
      return toIncident(rows[0]);
    },

    /**
     * El rider no pot completar el servei (client absent o un altre motiu): es registra la
     * incidència i el servei passa a 'incident', sense marcar-lo com a completat.
     */
    async report(serviceId, riderId, { kind, description, photoId }) {
      return inTransaction(pool, async (client) => {
        const { rows } = await client.query('SELECT status FROM deliveries WHERE id = $1 AND rider_id = $2 FOR UPDATE', [serviceId, riderId]);
        if (!rows[0]) throw notFoundError('Servicio no encontrado');
        if (rows[0].status !== 'in_transit') {
          throw conflictError('Inicia el servicio antes de registrar una incidencia', { reason: 'NOT_IN_TRANSIT', status: rows[0].status });
        }
        if (photoId) {
          const photo = await client.query('SELECT 1 FROM proof_photos WHERE id = $1 AND delivery_id = $2', [photoId, serviceId]);
          if (!photo.rows[0]) throw validationError('La foto no es de este servicio', { field: 'photoId' });
        }
        const incident = await client.query(
          'INSERT INTO incidents (delivery_id, kind, description, photo_id) VALUES ($1, $2, $3, $4) RETURNING *',
          [serviceId, kind, description, photoId ?? null],
        );
        await client.query("UPDATE deliveries SET status = 'incident' WHERE id = $1", [serviceId]);
        return toIncident(incident.rows[0]);
      });
    },

    /** A qui cal avisar d'una incidència: l'usuari del venedor i els administradors, i la reserva. */
    async recipients(serviceId) {
      const { rows } = await pool.query(
        `SELECT s.user_id AS seller_user_id, e.booking_number, d.delivery_type,
                (SELECT coalesce(array_agg(ur.user_id), '{}') FROM user_roles ur WHERE ur.role = 'admin') AS admin_ids
         FROM deliveries d JOIN sellers s ON s.id = d.seller_id JOIN events e ON e.id = d.event_id
         WHERE d.id = $1`,
        [serviceId],
      );
      const row = rows[0];
      return { sellerUserId: row.seller_user_id, adminIds: row.admin_ids, bookingNumber: row.booking_number, type: row.delivery_type };
    },

    /** Incidències (per a l'administrador), les obertes primer. */
    async list({ status } = {}) {
      const { rows } = await pool.query(
        `SELECT i.*, e.booking_number, d.delivery_type, s.legal_name
         FROM incidents i JOIN deliveries d ON d.id = i.delivery_id JOIN events e ON e.id = d.event_id JOIN sellers s ON s.id = d.seller_id
         WHERE ($1::text IS NULL OR i.status = $1)
         ORDER BY (i.status = 'open') DESC, i.created_at DESC
         LIMIT 200`,
        [status ?? null],
      );
      return rows.map(toIncident);
    },

    /** Un administrador resol una incidència oberta. @returns l'id de l'esdeveniment */
    async resolve(incidentId, adminId, note) {
      const { rows } = await pool.query(
        `UPDATE incidents i SET status = 'resolved', resolved_at = now(), resolved_by = $2, resolution_note = $3
         FROM deliveries d
         WHERE i.id = $1 AND i.status = 'open' AND d.id = i.delivery_id
         RETURNING d.event_id`,
        [incidentId, adminId, note],
      );
      if (rows[0]) return rows[0].event_id;
      const exists = await pool.query('SELECT 1 FROM incidents WHERE id = $1', [incidentId]);
      if (!exists.rows[0]) throw notFoundError('Incidencia no encontrada');
      throw conflictError('Esta incidencia ya está resuelta');
    },

    /** Esdeveniment d'un servei. */
    async eventOf(serviceId) {
      const { rows } = await pool.query('SELECT event_id FROM deliveries WHERE id = $1', [serviceId]);
      return rows[0]?.event_id ?? null;
    },

    /**
     * Tanca la reserva si ja s'han fet totes les recollides: passa de 'confirmed' a 'completed'.
     * @returns {{ completed: boolean, openIncidents: number }}
     */
    async settle(eventId) {
      const { rows } = await pool.query(
        `WITH done AS (
           UPDATE events e SET status = 'completed', updated_at = now()
           WHERE e.id = $1 AND e.status = 'confirmed'
             AND EXISTS (SELECT 1 FROM deliveries d WHERE d.event_id = e.id AND d.delivery_type = 'pickup')
             AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.event_id = e.id AND d.delivery_type = 'pickup' AND d.status <> 'delivered')
           RETURNING e.id
         )
         SELECT (SELECT status FROM events WHERE id = $1) = 'completed' OR EXISTS (SELECT 1 FROM done) AS completed,
                (SELECT count(*)::int FROM incidents i JOIN deliveries d ON d.id = i.delivery_id
                 WHERE d.event_id = $1 AND i.status = 'open') AS open_incidents`,
        [eventId],
      );
      return { completed: rows[0].completed, openIncidents: rows[0].open_incidents };
    },
  };
}
