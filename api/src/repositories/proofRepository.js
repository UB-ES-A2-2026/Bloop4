/**
 * Proves de lliurament i recollida (US-11): fotos de cada línia, checklist de l'estat del material
 * i incidències. Qui pot veure una prova: el rider del servei, el client de la reserva, el venedor
 * del servei i qualsevol administrador.
 */
import { conflictError, notFoundError, validationError } from '../errors.js';

export const MAX_PHOTOS_PER_SERVICE = 40;

// Línies de producte d'un servei (les del seu venedor dins de la reserva).
const SERVICE_ITEMS = `
  SELECT ei.id, p.name, ei.quantity
  FROM deliveries d
  JOIN event_items ei ON ei.event_id = d.event_id
  JOIN products p     ON p.id = ei.product_id AND p.seller_id = d.seller_id
  WHERE d.id = $1
  ORDER BY p.name, ei.id`;

const photoUrl = (id) => `/api/proofs/photos/${id}`;

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

export function createProofRepository(pool) {
  /** Servei del rider amb les seves línies, o 404. */
  async function riderService(serviceId, riderId, client = pool) {
    const { rows } = await client.query(
      'SELECT id, event_id, seller_id, delivery_type, status FROM deliveries WHERE id = $1 AND rider_id = $2',
      [serviceId, riderId],
    );
    if (!rows[0]) throw notFoundError('Servicio no encontrado');
    const items = (await client.query(SERVICE_ITEMS, [serviceId])).rows;
    return { ...rows[0], items };
  }

  return {
    riderService,

    /** El servei ha d'estar en curs per poder-hi afegir proves. */
    async requireInTransit(serviceId, riderId) {
      const service = await riderService(serviceId, riderId);
      if (service.status !== 'in_transit') {
        throw conflictError('Inicia el servicio antes de registrar la prueba', { reason: 'NOT_IN_TRANSIT', status: service.status });
      }
      return service;
    },

    /** Desa una foto d'una línia (o d'una incidència, si `eventItemId` és null). */
    async addPhoto({ deliveryId, eventItemId, path, contentType }) {
      const { rows } = await pool.query(
        `INSERT INTO proof_photos (delivery_id, event_item_id, path, content_type)
         SELECT $1, $2, $3, $4
         WHERE (SELECT count(*) FROM proof_photos WHERE delivery_id = $1) < $5
         RETURNING id, event_item_id, created_at`,
        [deliveryId, eventItemId, path, contentType, MAX_PHOTOS_PER_SERVICE],
      );
      if (!rows[0]) return null;
      return { id: rows[0].id, eventItemId: rows[0].event_item_id, url: photoUrl(rows[0].id), createdAt: rows[0].created_at };
    },

    /** Esborra una foto d'un servei encara no completat. Retorna la ruta del fitxer o null. */
    async deletePhoto(photoId, deliveryId) {
      const { rows } = await pool.query(
        `DELETE FROM proof_photos f
         WHERE f.id = $1 AND f.delivery_id = $2
           AND NOT EXISTS (SELECT 1 FROM delivery_proofs p WHERE p.delivery_id = f.delivery_id)
           AND NOT EXISTS (SELECT 1 FROM incidents i WHERE i.photo_id = f.id)
         RETURNING path`,
        [photoId, deliveryId],
      );
      return rows[0]?.path ?? null;
    },

    /** Fotos pujades d'un servei: [{ id, eventItemId, url }]. */
    async photos(deliveryId) {
      const { rows } = await pool.query(
        'SELECT id, event_item_id, created_at FROM proof_photos WHERE delivery_id = $1 ORDER BY created_at, id',
        [deliveryId],
      );
      return rows.map((r) => ({ id: r.id, eventItemId: r.event_item_id, url: photoUrl(r.id), createdAt: r.created_at }));
    },

    /**
     * Completa el servei: desa el checklist i el passa a 'delivered' en una sola transacció. Cada
     * línia del servei ha de tenir el seu estat i almenys una foto; si alguna cosa falla, el
     * servei no es marca com a completat.
     * @param items [{ eventItemId, condition, note }]
     * @returns {{ service, items, problems }} `problems`: les línies que no són correctes
     */
    async complete(serviceId, riderId, items) {
      return inTransaction(pool, async (client) => {
        await client.query('SELECT 1 FROM deliveries WHERE id = $1 FOR UPDATE', [serviceId]);
        const service = await riderService(serviceId, riderId, client);
        if (service.status !== 'in_transit') {
          throw conflictError('Inicia el servicio antes de registrar la prueba', { reason: 'NOT_IN_TRANSIT', status: service.status });
        }
        const byId = new Map(items.map((i) => [i.eventItemId, i]));
        const missing = service.items.filter((line) => !byId.has(line.id));
        const unknown = items.filter((i) => !service.items.some((line) => line.id === i.eventItemId));
        if (missing.length || unknown.length) {
          throw validationError('Indica el estado de todas las líneas del servicio', {
            field: 'items',
            missing: missing.map((l) => ({ eventItemId: l.id, name: l.name })),
          });
        }
        const photographed = new Set(
          (await client.query('SELECT DISTINCT event_item_id FROM proof_photos WHERE delivery_id = $1 AND event_item_id IS NOT NULL', [serviceId]))
            .rows.map((r) => r.event_item_id),
        );
        const withoutPhoto = service.items.filter((line) => !photographed.has(line.id));
        if (withoutPhoto.length) {
          throw validationError('Falta al menos una foto de cada producto', {
            field: 'photos',
            missing: withoutPhoto.map((l) => ({ eventItemId: l.id, name: l.name })),
          });
        }

        await client.query('INSERT INTO delivery_proofs (delivery_id, rider_id) VALUES ($1, $2)', [serviceId, riderId]);
        for (const line of service.items) {
          const { condition, note } = byId.get(line.id);
          await client.query('INSERT INTO proof_items (delivery_id, event_item_id, condition, note) VALUES ($1, $2, $3, $4)', [
            serviceId,
            line.id,
            condition,
            note,
          ]);
        }
        await client.query("UPDATE deliveries SET status = 'delivered' WHERE id = $1", [serviceId]);
        const problems = service.items
          .map((line) => ({ ...line, ...byId.get(line.id) }))
          .filter((line) => line.condition !== 'correct');
        return { service: { ...service, status: 'delivered' }, problems };
      });
    },

    /** Si `user` pot veure les proves del servei (rider, client, venedor o administrador). */
    async canView(deliveryId, user) {
      if (user.roles.includes('admin')) return true;
      const { rows } = await pool.query(
        `SELECT 1 FROM deliveries d
         JOIN events e  ON e.id = d.event_id
         JOIN sellers s ON s.id = d.seller_id
         WHERE d.id = $1 AND (d.rider_id = $2 OR e.customer_id = $2 OR s.user_id = $2)`,
        [deliveryId, user.id],
      );
      return rows.length > 0;
    },

    /** Foto per servir-la: { path, contentType, deliveryId } o null. */
    async findPhoto(photoId) {
      const { rows } = await pool.query('SELECT path, content_type, delivery_id FROM proof_photos WHERE id = $1', [photoId]);
      return rows[0] ? { path: rows[0].path, contentType: rows[0].content_type, deliveryId: rows[0].delivery_id } : null;
    },

    /** Prova d'un servei: checklist amb les fotos de cada línia i incidències. null si el servei no existeix. */
    async proof(deliveryId) {
      const { rows } = await pool.query(
        `SELECT d.id, d.delivery_type, d.status, s.legal_name, p.completed_at
         FROM deliveries d JOIN sellers s ON s.id = d.seller_id
         LEFT JOIN delivery_proofs p ON p.delivery_id = d.id
         WHERE d.id = $1`,
        [deliveryId],
      );
      if (!rows[0]) return null;
      const lines = (await pool.query(SERVICE_ITEMS, [deliveryId])).rows;
      const checklist = new Map(
        (await pool.query('SELECT event_item_id, condition, note FROM proof_items WHERE delivery_id = $1', [deliveryId])).rows.map((r) => [r.event_item_id, r]),
      );
      const photos = await this.photos(deliveryId);
      const incidents = await pool.query(
        `SELECT id, kind, description, photo_id, status, created_at, resolved_at, resolution_note
         FROM incidents WHERE delivery_id = $1 ORDER BY created_at, id`,
        [deliveryId],
      );
      return {
        serviceId: rows[0].id,
        type: rows[0].delivery_type,
        status: rows[0].status,
        seller: { legalName: rows[0].legal_name },
        completedAt: rows[0].completed_at,
        items: lines.map((line) => ({
          eventItemId: line.id,
          name: line.name,
          quantity: line.quantity,
          condition: checklist.get(line.id)?.condition ?? null,
          note: checklist.get(line.id)?.note ?? null,
          photos: photos.filter((p) => p.eventItemId === line.id).map(({ id, url }) => ({ id, url })),
        })),
        incidents: incidents.rows.map((i) => ({
          id: i.id,
          kind: i.kind,
          description: i.description,
          photoUrl: i.photo_id ? photoUrl(i.photo_id) : null,
          status: i.status,
          createdAt: i.created_at,
          resolvedAt: i.resolved_at,
          resolutionNote: i.resolution_note,
        })),
      };
    },

    /** Serveis del venedor (per consultar-ne les proves), dels més recents als més antics. */
    async sellerServices(sellerId, limit = 100) {
      const { rows } = await pool.query(
        `SELECT d.id, d.delivery_type, d.status, lower(d.time_window) AS starts_at, upper(d.time_window) AS ends_at,
                e.booking_number, (p.delivery_id IS NOT NULL) AS has_proof,
                (SELECT count(*)::int FROM incidents i WHERE i.delivery_id = d.id AND i.status = 'open') AS open_incidents
         FROM deliveries d
         JOIN events e ON e.id = d.event_id
         LEFT JOIN delivery_proofs p ON p.delivery_id = d.id
         WHERE d.seller_id = $1 AND e.status NOT IN ('draft', 'pending_payment')
         ORDER BY lower(d.time_window) DESC, d.id
         LIMIT $2`,
        [sellerId, limit],
      );
      return rows.map((r) => ({
        id: r.id,
        type: r.delivery_type,
        status: r.status,
        timeWindow: { startsAt: r.starts_at, endsAt: r.ends_at },
        bookingNumber: r.booking_number,
        hasProof: r.has_proof,
        openIncidents: r.open_incidents,
      }));
    },
  };
}
