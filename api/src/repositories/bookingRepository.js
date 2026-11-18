/**
 * Reserves (US-12). Confirmar la cistella la converteix en una reserva 'pending_payment' amb
 * unitats físiques assignades durant 15 minuts. Tot passa en una sola transacció: o es bloquegen
 * totes les unitats de totes les línies o no se'n bloqueja cap.
 */
import { ApiError, conflictError } from '../errors.js';

export const HOLD_MINUTES = 15;
export const MAX_PENDING_BOOKINGS = 3;
export const MIN_NOTICE_HOURS = 24;
const EXCLUSION_VIOLATION = '23P01';

// Línies de la cistella amb el que cal revalidar: producte publicat i preu sense canvis.
const LINES = `
  SELECT ei.id, ei.product_id, ei.quantity, p.name, p.seller_id, s.prep_margin,
         p.status = 'published' AS published,
         (ei.daily_price = p.daily_price AND ei.deposit_amount = p.deposit_amount) AS same_price
  FROM event_items ei
  JOIN products p ON p.id = ei.product_id
  JOIN sellers s  ON s.id = p.seller_id
  WHERE ei.event_id = $1
  ORDER BY ei.product_id`;

// Interval logístic de cada venedor (del principi del lliurament al final de la recollida) i si
// les franges continuen sent vàlides: abans i després de l'esdeveniment, amb 24 h d'antelació,
// dins de la zona de repartiment i amb capacitat a la franja.
const LOGISTICS = `
  SELECT d.seller_id,
         min(lower(d.time_window)) FILTER (WHERE d.delivery_type = 'delivery') AS delivery_start,
         max(upper(d.time_window)) FILTER (WHERE d.delivery_type = 'delivery') AS delivery_end,
         min(lower(d.time_window)) FILTER (WHERE d.delivery_type = 'pickup')   AS pickup_start,
         max(upper(d.time_window)) FILTER (WHERE d.delivery_type = 'pickup')   AS pickup_end,
         EXISTS (SELECT 1 FROM seller_postal_codes c WHERE c.seller_id = d.seller_id AND c.postal_code = a.postal_code) AS covered,
         bool_and((SELECT count(*) FROM deliveries o JOIN events oe ON oe.id = o.event_id
                   WHERE o.seller_id = d.seller_id AND o.event_id <> d.event_id AND o.status <> 'cancelled'
                     AND oe.status NOT IN ('draft', 'cancelled') AND o.time_window && d.time_window) < s.delivery_capacity) AS has_capacity
  FROM deliveries d
  JOIN events e    ON e.id = d.event_id
  JOIN addresses a ON a.id = e.address_id
  JOIN sellers s   ON s.id = d.seller_id
  WHERE d.event_id = $1
  GROUP BY d.seller_id, a.postal_code`;

// Unitats del producte $1 lliures durant [$2, $3) ampliat amb el marge de preparació $4.
const FREE_UNITS = `
  SELECT u.id
  FROM product_units u
  WHERE u.product_id = $1 AND u.status = 'available'
    AND NOT EXISTS (
      SELECT 1 FROM event_item_units r
      WHERE r.unit_id = u.id AND r.is_active
        AND r.reserved_period && tstzrange($2::timestamptz - $4::interval, $3::timestamptz + $4::interval, '[)'))
  ORDER BY u.id`;

const BOOKING = `
  SELECT e.id, e.customer_id, e.status, e.booking_number, e.hold_expires_at, e.confirmed_at,
         e.starts_at, e.ends_at, e.created_at
  FROM events e`;

function toBooking(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    bookingNumber: row.booking_number,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
    confirmedAt: row.confirmed_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

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

/**
 * Allibera el bloqueig d'una reserva pendent: desactiva les unitats i la torna a deixar com a
 * cistella (o la cancel·la si el client ja en té una altra d'oberta).
 */
async function releaseHold(client, event, { expired }) {
  await client.query(
    `UPDATE event_item_units SET is_active = false
     WHERE is_active AND event_item_id IN (SELECT id FROM event_items WHERE event_id = $1)`,
    [event.id],
  );
  await client.query(
    `UPDATE events e
     SET status = CASE WHEN EXISTS (SELECT 1 FROM events d WHERE d.customer_id = e.customer_id AND d.status = 'draft')
                       THEN 'cancelled' ELSE 'draft' END,
         hold_expires_at = NULL, checkout_key = NULL, updated_at = now(),
         hold_expired_at = CASE WHEN $2 THEN now() ELSE NULL END
     WHERE e.id = $1`,
    [event.id, expired],
  );
}

/** Allibera els bloquejos caducats (de tots els clients o només d'un). Retorna quants. */
async function releaseExpired(client, customerId = null) {
  const { rows } = await client.query(
    `SELECT id FROM events
     WHERE status = 'pending_payment' AND hold_expires_at <= now() AND ($1::uuid IS NULL OR customer_id = $1)
     ORDER BY hold_expires_at, id
     FOR UPDATE SKIP LOCKED`,
    [customerId],
  );
  for (const event of rows) await releaseHold(client, event, { expired: true });
  return rows.length;
}

const invalid = (message, reason, details = {}) => new ApiError(409, 'CONFLICT', message, { reason, ...details });

/** Comprova que la cistella encara es pot reservar; retorna les línies i la logística per venedor. */
async function revalidate(client, event) {
  if (!event.starts_at || event.starts_at <= new Date()) {
    throw invalid('Las fechas del evento ya no son válidas', 'DATES_INVALID');
  }
  const lines = (await client.query(LINES, [event.id])).rows;
  if (lines.length === 0) throw invalid('Tu reserva está vacía', 'EMPTY');
  const changed = lines.filter((l) => !l.published || !l.same_price);
  if (changed.length) {
    throw invalid('Algunos productos han cambiado. Revisa tu reserva antes de continuar', 'CART_CHANGED', {
      products: changed.map((l) => ({ id: l.product_id, name: l.name })),
    });
  }

  // Els checkouts d'un mateix venedor fan cua: així dos clients no ocupen alhora l'última plaça
  // d'una franja de repartiment.
  await client.query('SELECT id FROM sellers WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [
    [...new Set(lines.map((l) => l.seller_id))],
  ]);
  const logistics = new Map((await client.query(LOGISTICS, [event.id])).rows.map((r) => [r.seller_id, r]));
  const earliest = Date.now() + MIN_NOTICE_HOURS * 60 * 60 * 1000;
  for (const line of lines) {
    const l = logistics.get(line.seller_id);
    if (!l?.delivery_start || !l.pickup_start) throw invalid('Elige la entrega y la recogida antes de confirmar', 'DELIVERY_MISSING');
    if (!l.covered) throw invalid('Esta dirección está fuera de la zona de reparto', 'DELIVERY_INVALID');
    if (l.delivery_end > event.starts_at || l.pickup_start < event.ends_at || l.delivery_start.getTime() < earliest || !l.has_capacity) {
      throw invalid('Las franjas de entrega o recogida ya no están disponibles. Vuelve a elegirlas', 'DELIVERY_INVALID');
    }
  }
  return { lines, logistics };
}

/**
 * Assigna `line.quantity` unitats lliures a la línia. Primer bloqueja les unitats del producte
 * (les peticions simultànies sobre el mateix producte fan cua) i després torna a mirar quines
 * queden lliures. Si tot i així l'EXCLUDE rebutja una unitat (23P01), es prova la següent.
 */
async function assignUnits(client, line, period) {
  await client.query("SELECT id FROM product_units WHERE product_id = $1 AND status = 'available' ORDER BY id FOR UPDATE", [line.product_id]);
  const free = (await client.query(FREE_UNITS, [line.product_id, period.from, period.to, line.prep_margin])).rows;
  let assigned = 0;
  for (const unit of free) {
    if (assigned === line.quantity) break;
    await client.query('SAVEPOINT unit');
    try {
      await client.query(
        "INSERT INTO event_item_units (event_item_id, unit_id, reserved_period) VALUES ($1, $2, tstzrange($3, $4, '[)'))",
        [line.id, unit.id, period.from, period.to],
      );
      await client.query('RELEASE SAVEPOINT unit');
      assigned++;
    } catch (err) {
      if (err.code !== EXCLUSION_VIOLATION) throw err;
      await client.query('ROLLBACK TO SAVEPOINT unit');
    }
  }
  if (assigned < line.quantity) {
    throw conflictError(`«${line.name}» ya no está disponible en las fechas del evento`, {
      reason: 'UNAVAILABLE',
      productId: line.product_id,
      productName: line.name,
      availableUnits: assigned,
    });
  }
}

export function createBookingRepository(pool) {
  return {
    /**
     * Converteix la cistella del client en una reserva pendent de pagament. Repetir la petició
     * amb la mateixa `idempotencyKey` retorna la reserva que ja es va crear (`created: false`).
     * @returns {Promise<{ id: string, created: boolean }>}
     * @throws ApiError 409 amb `details.reason` si alguna cosa ja no és vàlida
     */
    async checkout(customerId, { idempotencyKey }) {
      return inTransaction(pool, async (client) => {
        // Les unitats de bloquejos caducats tornen a estar lliures abans d'assignar-ne de noves.
        await releaseExpired(client);
        const { rows } = await client.query(
          "SELECT id, starts_at, ends_at FROM events WHERE customer_id = $1 AND status = 'draft' FOR UPDATE",
          [customerId],
        );
        // Es mira després d'esperar el bloqueig de la cistella: una petició repetida que arriba
        // alhora troba aquí la reserva que acaba de crear la primera.
        const repeated = await client.query(
          "SELECT id FROM events WHERE customer_id = $1 AND checkout_key = $2 AND status <> 'draft'",
          [customerId, idempotencyKey],
        );
        if (repeated.rows[0]) return { id: repeated.rows[0].id, created: false };
        const event = rows[0];
        if (!event) throw invalid('Tu reserva está vacía', 'EMPTY');

        const pending = await client.query("SELECT count(*)::int AS n FROM events WHERE customer_id = $1 AND status = 'pending_payment'", [customerId]);
        if (pending.rows[0].n >= MAX_PENDING_BOOKINGS) {
          throw invalid(`Tienes ${MAX_PENDING_BOOKINGS} reservas pendientes de pago. Págalas o cancélalas antes de crear otra`, 'TOO_MANY_PENDING');
        }

        const { lines, logistics } = await revalidate(client, event);
        for (const line of lines) {
          const l = logistics.get(line.seller_id);
          await assignUnits(client, line, { from: l.delivery_start, to: l.pickup_end });
        }
        await client.query(
          `UPDATE events SET status = 'pending_payment', hold_expires_at = now() + make_interval(mins => $2),
                             hold_expired_at = NULL, checkout_key = $3, updated_at = now()
           WHERE id = $1`,
          [event.id, HOLD_MINUTES, idempotencyKey],
        );
        return { id: event.id, created: true };
      });
    },

    /** Reserva (qualsevol estat menys la cistella) o null. */
    async findBooking(eventId) {
      const { rows } = await pool.query(`${BOOKING} WHERE e.id = $1 AND e.status <> 'draft'`, [eventId]);
      return rows[0] ? toBooking(rows[0]) : null;
    },

    /** Reserves del client, de la més recent a la més antiga. */
    async listBookings(customerId) {
      const { rows } = await pool.query(
        `${BOOKING} WHERE e.customer_id = $1 AND e.status <> 'draft' AND e.booking_number IS NOT NULL
         ORDER BY e.created_at DESC, e.id`,
        [customerId],
      );
      return rows.map(toBooking);
    },

    /** Allibera els bloquejos caducats sense pagament. Retorna quants n'ha alliberat. */
    async releaseExpiredHolds(customerId = null) {
      return inTransaction(pool, (client) => releaseExpired(client, customerId));
    },

    /** El client renuncia a una reserva pendent: torna a ser la cistella. false si ja no ho és. */
    async cancelHold(eventId) {
      return inTransaction(pool, async (client) => {
        const { rows } = await client.query("SELECT id FROM events WHERE id = $1 AND status = 'pending_payment' FOR UPDATE", [eventId]);
        if (!rows[0]) return false;
        await releaseHold(client, rows[0], { expired: false });
        return true;
      });
    },

    /**
     * Confirma una reserva pendent (el pagament s'ha completat). Retorna la reserva i els
     * venedors que cal avisar, o null si ja no estava pendent.
     */
    async confirm(eventId) {
      return inTransaction(pool, async (client) => {
        const { rows } = await client.query(
          `UPDATE events SET status = 'confirmed', confirmed_at = now(), hold_expires_at = NULL, updated_at = now()
           WHERE id = $1 AND status = 'pending_payment'
           RETURNING id, customer_id, status, booking_number, hold_expires_at, confirmed_at, starts_at, ends_at, created_at`,
          [eventId],
        );
        if (!rows[0]) return null;
        const sellers = await client.query(
          `SELECT DISTINCT s.id, s.legal_name, u.id AS user_id, u.email
           FROM event_items ei
           JOIN products p ON p.id = ei.product_id
           JOIN sellers s  ON s.id = p.seller_id
           LEFT JOIN users u ON u.id = s.user_id
           WHERE ei.event_id = $1
           ORDER BY s.legal_name`,
          [eventId],
        );
        return {
          booking: toBooking(rows[0]),
          sellers: sellers.rows.map((r) => ({ id: r.id, legalName: r.legal_name, userId: r.user_id, email: r.email })),
        };
      });
    },
  };
}
