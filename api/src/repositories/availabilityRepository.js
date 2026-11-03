/**
 * Disponibilitat d'un producte (US-05). Una unitat està lliure en [from, to) si el seu estat és
 * 'available' i no té cap reserva activa que se solapi amb l'interval ampliat amb el marge de
 * preparació del venedor (abans i després). És una consulta informativa: no bloqueja res.
 */

// $1 producte, $2 inici, $3 fi. Dies facturables: blocs de 24 h arrodonits a l'alça, mínim 1.
const AVAILABILITY = `
  WITH product AS (
    SELECT p.id, p.daily_price, p.currency, s.prep_margin
    FROM products p JOIN sellers s ON s.id = p.seller_id
    WHERE p.id = $1 AND p.status = 'published'
  ),
  days AS (
    SELECT greatest(1, ceil(extract(epoch FROM ($3::timestamptz - $2::timestamptz)) / 86400))::int AS n
  )
  SELECT product.currency, days.n AS billable_days,
         (product.daily_price * days.n)::numeric(12,2) AS total_price,
         count(u.id)::int AS total_units,
         count(u.id) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM event_item_units r
           WHERE r.unit_id = u.id AND r.is_active
             AND r.reserved_period && tstzrange($2::timestamptz - product.prep_margin, $3::timestamptz + product.prep_margin, '[)')
         ))::int AS available_units
  FROM product
  CROSS JOIN days
  LEFT JOIN product_units u ON u.product_id = product.id AND u.status = 'available'
  GROUP BY product.id, product.currency, product.daily_price, days.n`;

// $1 producte, $2 primer dia del mes. Dies (hora de Madrid) en què cap unitat està lliure tot el dia.
const CALENDAR = `
  WITH product AS (
    SELECT p.id, s.prep_margin
    FROM products p JOIN sellers s ON s.id = p.seller_id
    WHERE p.id = $1 AND p.status = 'published'
  ),
  days AS (
    SELECT d::date AS day,
           (d::date)::timestamp AT TIME ZONE 'Europe/Madrid'     AS starts_at,
           (d::date + 1)::timestamp AT TIME ZONE 'Europe/Madrid' AS ends_at
    FROM generate_series($2::date, ($2::date + interval '1 month' - interval '1 day'), interval '1 day') AS d
  )
  SELECT (SELECT count(*) FROM product)::int AS found,
         coalesce(array_agg(to_char(days.day, 'YYYY-MM-DD') ORDER BY days.day)
                  FILTER (WHERE product.id IS NOT NULL), '{}') AS unavailable_days
  FROM days
  LEFT JOIN product ON NOT EXISTS (
    SELECT 1 FROM product_units u
    WHERE u.product_id = product.id AND u.status = 'available'
      AND NOT EXISTS (
        SELECT 1 FROM event_item_units r
        WHERE r.unit_id = u.id AND r.is_active
          AND r.reserved_period && tstzrange(days.starts_at - product.prep_margin, days.ends_at + product.prep_margin, '[)')
      )
  )`;

export function createAvailabilityRepository(pool) {
  return {
    /** @returns {Promise<object | null>} null si el producte no existeix o no està publicat */
    async check(productId, { from, to }) {
      const { rows } = await pool.query(AVAILABILITY, [productId, from, to]);
      const row = rows[0];
      if (!row) return null;
      return {
        availableUnits: row.available_units,
        totalUnits: row.total_units,
        billableDays: row.billable_days,
        totalPrice: row.total_price,
        currency: row.currency,
      };
    },

    /** @returns {Promise<string[] | null>} dies sense cap unitat lliure ('AAAA-MM-DD') */
    async unavailableDays(productId, month) {
      const { rows } = await pool.query(CALENDAR, [productId, `${month}-01`]);
      return rows[0].found ? rows[0].unavailable_days : null;
    },
  };
}
