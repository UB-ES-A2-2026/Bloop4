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

export function createDeliveryRepository(pool) {
  return {
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
