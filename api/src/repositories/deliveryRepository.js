/**
 * Lliurament i recollida (US-07). La cobertura és per codis postals de cada venedor i les
 * franges són de 2 h (de 08:00 a 22:00, hora de Madrid). Una franja està plena per a un venedor
 * quan ja té `delivery_capacity` lliuraments o recollides de comandes en curs que s'hi solapen.
 */

// Venedors de la cistella $1 que no reparteixen al codi postal $2.
const UNCOVERED = `
  SELECT DISTINCT s.id, s.legal_name
  FROM event_items ei
  JOIN products p ON p.id = ei.product_id
  JOIN sellers s  ON s.id = p.seller_id
  WHERE ei.event_id = $1
    AND NOT EXISTS (SELECT 1 FROM seller_postal_codes c WHERE c.seller_id = s.id AND c.postal_code = $2)
  ORDER BY s.legal_name`;

// Franges del dia $2 per a la cistella $1: disponible si tots els seus venedors tenen capacitat.
const SLOTS = `
  WITH sellers_in_cart AS (
    SELECT DISTINCT s.id, s.delivery_capacity
    FROM event_items ei JOIN products p ON p.id = ei.product_id JOIN sellers s ON s.id = p.seller_id
    WHERE ei.event_id = $1
  ),
  slots AS (
    SELECT tstzrange(t AT TIME ZONE 'Europe/Madrid', (t + interval '2 hours') AT TIME ZONE 'Europe/Madrid', '[)') AS window
    FROM generate_series($2::date + time '08:00', $2::date + time '20:00', interval '2 hours') AS t
  )
  SELECT lower(slots.window) AS starts_at, upper(slots.window) AS ends_at,
         NOT EXISTS (
           SELECT 1 FROM sellers_in_cart sc
           WHERE (SELECT count(*) FROM deliveries d JOIN events e ON e.id = d.event_id
                  WHERE d.seller_id = sc.id AND d.status <> 'cancelled'
                    AND e.status NOT IN ('draft', 'cancelled') AND d.time_window && slots.window) >= sc.delivery_capacity
         ) AS has_capacity
  FROM slots
  ORDER BY slots.window`;

// Pes (kg) i volum (m³) que porta cada venedor de la cistella $1 i el vehicle més barat que hi cap.
const LOADS = `
  WITH loads AS (
    SELECT p.seller_id,
           sum(coalesce(p.weight_kg, 0) * ei.quantity) AS weight_kg,
           sum(coalesce(p.length_cm * p.width_cm * p.height_cm, 0) / 1000000 * ei.quantity) AS volume_m3
    FROM event_items ei JOIN products p ON p.id = ei.product_id
    WHERE ei.event_id = $1
    GROUP BY p.seller_id
  )
  SELECT l.seller_id, s.legal_name, round(l.weight_kg, 2) AS weight_kg, round(l.volume_m3, 3) AS volume_m3,
         v.code AS vehicle_type, v.name AS vehicle_name, v.price, v.currency
  FROM loads l
  JOIN sellers s ON s.id = l.seller_id
  CROSS JOIN LATERAL (
    SELECT * FROM vehicle_types v
    WHERE (v.max_weight_kg IS NULL OR v.max_weight_kg >= l.weight_kg)
      AND (v.max_volume_m3 IS NULL OR v.max_volume_m3 >= l.volume_m3)
    ORDER BY v.price, v.code
    LIMIT 1
  ) v
  ORDER BY s.legal_name, s.id`;

const DELIVERY = `
  SELECT a.street, a.postal_code, a.city, a.access_instructions,
         (SELECT lower(d.time_window) FROM deliveries d WHERE d.event_id = e.id AND d.delivery_type = 'delivery' LIMIT 1) AS delivery_starts_at,
         (SELECT upper(d.time_window) FROM deliveries d WHERE d.event_id = e.id AND d.delivery_type = 'delivery' LIMIT 1) AS delivery_ends_at,
         (SELECT lower(d.time_window) FROM deliveries d WHERE d.event_id = e.id AND d.delivery_type = 'pickup' LIMIT 1) AS pickup_starts_at,
         (SELECT upper(d.time_window) FROM deliveries d WHERE d.event_id = e.id AND d.delivery_type = 'pickup' LIMIT 1) AS pickup_ends_at
  FROM events e JOIN addresses a ON a.id = e.address_id
  WHERE e.id = $1`;

const TRANSPORT = `
  SELECT t.seller_id, s.legal_name, t.vehicle_type, v.name AS vehicle_name, t.price, t.currency
  FROM event_transport t JOIN sellers s ON s.id = t.seller_id JOIN vehicle_types v ON v.code = t.vehicle_type
  WHERE t.event_id = $1
  ORDER BY s.legal_name, s.id`;

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

/** Torna a calcular el vehicle i el preu de cada venedor segons el que hi ha ara a la cistella. */
async function writeTransport(client, eventId) {
  const loads = (await client.query(LOADS, [eventId])).rows;
  await client.query('DELETE FROM event_transport WHERE event_id = $1', [eventId]);
  for (const load of loads) {
    await client.query(
      'INSERT INTO event_transport (event_id, seller_id, vehicle_type, price, currency) VALUES ($1, $2, $3, $4, $5)',
      [eventId, load.seller_id, load.vehicle_type, load.price, load.currency],
    );
    await client.query('UPDATE deliveries SET vehicle_type = $3 WHERE event_id = $1 AND seller_id = $2', [
      eventId,
      load.seller_id,
      load.vehicle_type,
    ]);
  }
  // Els venedors que ja no tenen cap línia a la cistella deixen de fer el lliurament.
  await client.query(
    'DELETE FROM deliveries WHERE event_id = $1 AND NOT (seller_id = ANY($2::uuid[]))',
    [eventId, loads.map((l) => l.seller_id)],
  );
}

export function createDeliveryRepository(pool) {
  return {
    /** Pes, volum i vehicle de cada venedor de la cistella. */
    async loads(eventId) {
      const { rows } = await pool.query(LOADS, [eventId]);
      return rows.map((r) => ({
        seller: { id: r.seller_id, legalName: r.legal_name },
        weightKg: r.weight_kg,
        volumeM3: r.volume_m3,
        vehicle: { type: r.vehicle_type, name: r.vehicle_name },
        price: r.price,
        currency: r.currency,
      }));
    },

    /**
     * Desa l'adreça i les franges de lliurament i recollida de la cistella: un lliurament i una
     * recollida per venedor amb el vehicle que li toca, i el preu del transport de cadascun.
     */
    async saveDelivery(eventId, userId, { address, deliveryWindow, pickupWindow }) {
      await inTransaction(pool, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO addresses (user_id, street, postal_code, city, access_instructions)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [userId, address.street, address.postalCode, address.city, address.accessInstructions],
        );
        await client.query('UPDATE events SET address_id = $2, updated_at = now() WHERE id = $1', [eventId, rows[0].id]);
        await client.query('DELETE FROM deliveries WHERE event_id = $1', [eventId]);
        const loads = (await client.query(LOADS, [eventId])).rows;
        for (const load of loads) {
          for (const [type, window] of [['delivery', deliveryWindow], ['pickup', pickupWindow]]) {
            await client.query(
              `INSERT INTO deliveries (event_id, seller_id, delivery_type, time_window, vehicle_type)
               VALUES ($1, $2, $3, tstzrange($4, $5, '[)'), $6)`,
              [eventId, load.seller_id, type, window.startsAt, window.endsAt, load.vehicle_type],
            );
          }
        }
        await writeTransport(client, eventId);
      });
    },

    /**
     * Lliurament desat de la cistella (o null), amb el transport recalculat per si la cistella
     * ha canviat des que es va desar.
     */
    async getDelivery(eventId) {
      const delivery = (await pool.query(DELIVERY, [eventId])).rows[0];
      if (!delivery?.delivery_starts_at) return null;
      await inTransaction(pool, (client) => writeTransport(client, eventId));
      const transport = (await pool.query(TRANSPORT, [eventId])).rows;
      const total = (await pool.query('SELECT coalesce(sum(price), 0)::numeric(12,2) AS total FROM event_transport WHERE event_id = $1', [eventId])).rows[0].total;
      return {
        address: {
          street: delivery.street,
          postalCode: delivery.postal_code,
          city: delivery.city,
          accessInstructions: delivery.access_instructions,
        },
        deliveryWindow: { startsAt: delivery.delivery_starts_at, endsAt: delivery.delivery_ends_at },
        pickupWindow: { startsAt: delivery.pickup_starts_at, endsAt: delivery.pickup_ends_at },
        transport: transport.map((t) => ({
          seller: { id: t.seller_id, legalName: t.legal_name },
          vehicle: { type: t.vehicle_type, name: t.vehicle_name },
          price: t.price,
          currency: t.currency,
        })),
        transportTotal: total,
      };
    },

    /** Suma exacta (numeric) de dos imports en string. */
    async addAmounts(a, b) {
      const { rows } = await pool.query('SELECT ($1::numeric + $2::numeric)::numeric(12,2) AS total', [a, b]);
      return rows[0].total;
    },

    /** Venedors de la cistella que no arriben al codi postal: [{ id, legalName }]. */
    async uncoveredSellers(eventId, postalCode) {
      const { rows } = await pool.query(UNCOVERED, [eventId, postalCode]);
      return rows.map((r) => ({ id: r.id, legalName: r.legal_name }));
    },

    /** Franges de 2 h d'un dia ('AAAA-MM-DD') amb `hasCapacity` per a tots els venedors de la cistella. */
    async slots(eventId, date) {
      const { rows } = await pool.query(SLOTS, [eventId, date]);
      return rows.map((r) => ({ startsAt: r.starts_at, endsAt: r.ends_at, hasCapacity: r.has_capacity }));
    },
  };
}
