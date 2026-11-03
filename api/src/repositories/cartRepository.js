/**
 * Cistella del client (US-06): l'esdeveniment en estat 'draft'. Tots els imports es calculen a
 * SQL (numeric) i surten com a string; l'API i el frontend no hi fan aritmètica.
 */

// Dies facturables de l'esdeveniment: blocs de 24 h arrodonits a l'alça, mínim 1.
const BILLABLE_DAYS = `greatest(1, ceil(extract(epoch FROM (e.ends_at - e.starts_at)) / 86400))::int`;

const ITEMS = `
  SELECT ei.id, ei.quantity, ei.daily_price, ei.deposit_amount, ei.currency, ei.insurance,
         p.id AS product_id, p.name AS product_name, p.status AS product_status, p.daily_price AS current_price,
         s.id AS seller_id, s.legal_name AS seller_legal_name, s.city AS seller_city,
         (SELECT i.path FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image,
         (ei.daily_price * ei.quantity * ${BILLABLE_DAYS})::numeric(12,2) AS rental_subtotal,
         (ei.deposit_amount * ei.quantity)::numeric(12,2) AS deposit_subtotal
  FROM event_items ei
  JOIN events e   ON e.id = ei.event_id
  JOIN products p ON p.id = ei.product_id
  JOIN sellers s  ON s.id = p.seller_id
  WHERE ei.event_id = $1
  ORDER BY s.legal_name, s.id, ei.added_at, ei.id`;

// Subtotals per venedor i, a la fila amb seller_id NULL (ROLLUP), el total de la cistella.
const TOTALS = `
  SELECT p.seller_id,
         sum(ei.daily_price * ei.quantity * ${BILLABLE_DAYS})::numeric(12,2) AS rental,
         sum(ei.deposit_amount * ei.quantity)::numeric(12,2) AS deposit
  FROM event_items ei
  JOIN events e   ON e.id = ei.event_id
  JOIN products p ON p.id = ei.product_id
  WHERE ei.event_id = $1
  GROUP BY ROLLUP (p.seller_id)`;

function toItem(row) {
  return {
    id: row.id,
    product: { id: row.product_id, name: row.product_name, image: row.image, status: row.product_status },
    quantity: row.quantity,
    dailyPrice: row.daily_price,
    currentDailyPrice: row.current_price,
    depositAmount: row.deposit_amount,
    currency: row.currency,
    insurance: row.insurance,
    rentalSubtotal: row.rental_subtotal,
    depositSubtotal: row.deposit_subtotal,
  };
}

export const EMPTY_CART = {
  id: null,
  startsAt: null,
  endsAt: null,
  billableDays: null,
  currency: 'EUR',
  sellers: [],
  totals: { rental: '0.00', deposit: '0.00', toPay: '0.00' },
};

export function createCartRepository(pool) {
  return {
    /** Cistella oberta del client: { id, startsAt, endsAt } o null. */
    async findDraft(customerId) {
      const { rows } = await pool.query(
        "SELECT id, starts_at, ends_at FROM events WHERE customer_id = $1 AND status = 'draft'",
        [customerId],
      );
      return rows[0] ? { id: rows[0].id, startsAt: rows[0].starts_at, endsAt: rows[0].ends_at } : null;
    },

    /** Crea la cistella amb les dates o, si ja n'hi ha una, li canvia les dates. */
    async saveDates(customerId, { startsAt, endsAt }) {
      const { rows } = await pool.query(
        `INSERT INTO events (customer_id, status, starts_at, ends_at)
         VALUES ($1, 'draft', $2, $3)
         ON CONFLICT (customer_id) WHERE status = 'draft'
         DO UPDATE SET starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, updated_at = now()
         RETURNING id`,
        [customerId, startsAt, endsAt],
      );
      return rows[0].id;
    },

    /** Línia de cistella amb el seu propietari: { eventId, customerId, status, productId } o null. */
    async findItem(itemId) {
      const { rows } = await pool.query(
        `SELECT ei.event_id, ei.product_id, e.customer_id, e.status
         FROM event_items ei JOIN events e ON e.id = ei.event_id
         WHERE ei.id = $1`,
        [itemId],
      );
      const row = rows[0];
      return row ? { eventId: row.event_id, productId: row.product_id, customerId: row.customer_id, status: row.status } : null;
    },

    /** Quantitat que ja hi ha a la cistella d'un producte (0 si no hi és). */
    async quantityOf(eventId, productId) {
      const { rows } = await pool.query('SELECT quantity FROM event_items WHERE event_id = $1 AND product_id = $2', [eventId, productId]);
      return rows[0]?.quantity ?? 0;
    },

    async isPublished(productId) {
      const { rows } = await pool.query("SELECT 1 FROM products WHERE id = $1 AND status = 'published'", [productId]);
      return rows.length > 0;
    },

    /**
     * Deixa la línia del producte amb `quantity` unitats. El preu, la fiança, la moneda i
     * l'assegurança es tornen a copiar del producte: afegir o canviar una línia la deixa revisada.
     */
    async setItem(eventId, productId, quantity) {
      await pool.query(
        `INSERT INTO event_items (event_id, product_id, quantity, daily_price, deposit_amount, currency, insurance)
         SELECT $1, p.id, $3, p.daily_price, p.deposit_amount, p.currency, p.insurance FROM products p WHERE p.id = $2
         ON CONFLICT (event_id, product_id) DO UPDATE
         SET quantity = EXCLUDED.quantity, daily_price = EXCLUDED.daily_price, deposit_amount = EXCLUDED.deposit_amount,
             currency = EXCLUDED.currency, insurance = EXCLUDED.insurance`,
        [eventId, productId, quantity],
      );
      await this.touch(eventId);
    },

    async deleteItem(eventId, itemId) {
      await pool.query('DELETE FROM event_items WHERE id = $1 AND event_id = $2', [itemId, eventId]);
      await this.touch(eventId);
    },

    async touch(eventId) {
      await pool.query('UPDATE events SET updated_at = now() WHERE id = $1', [eventId]);
    },

    /** Cistella completa agrupada per venedor, amb subtotals i totals calculats a SQL. */
    async getCart(eventId) {
      const event = await pool.query(
        `SELECT e.id, e.starts_at, e.ends_at, ${BILLABLE_DAYS} AS billable_days FROM events e WHERE e.id = $1`,
        [eventId],
      );
      const items = await pool.query(ITEMS, [eventId]);
      const totals = await pool.query(TOTALS, [eventId]);
      const bySeller = new Map(totals.rows.filter((t) => t.seller_id).map((t) => [t.seller_id, t]));
      const grand = totals.rows.find((t) => !t.seller_id);

      const sellers = [];
      for (const row of items.rows) {
        let group = sellers.at(-1);
        if (group?.seller.id !== row.seller_id) {
          const subtotal = bySeller.get(row.seller_id);
          group = {
            seller: { id: row.seller_id, legalName: row.seller_legal_name, city: row.seller_city },
            items: [],
            rentalSubtotal: subtotal.rental,
            depositSubtotal: subtotal.deposit,
          };
          sellers.push(group);
        }
        group.items.push(toItem(row));
      }

      const e = event.rows[0];
      return {
        id: e.id,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        billableDays: e.billable_days,
        currency: 'EUR',
        sellers,
        // La fiança només es reté; el que es paga és el lloguer (US-07 hi afegirà el transport).
        totals: {
          rental: grand?.rental ?? '0.00',
          deposit: grand?.deposit ?? '0.00',
          toPay: grand?.rental ?? '0.00',
        },
      };
    },
  };
}
