/**
 * Reserves (esquema comú del Sprint 2): llegir les reserves del client i confirmar-ne una quan s'ha
 * pagat. Ho fan servir diverses històries: la confirmació de la reserva (US-12), el pagament
 * (US-08), el seguiment (US-09) i el mapa (US-16). Crear-les i bloquejar-ne les unitats és de US-12
 * (`checkoutRepository`).
 */

/** Columnes de la reserva; `toBooking` les passa al contracte JSON. */
export const BOOKING = `
  SELECT e.id, e.customer_id, e.status, e.booking_number, e.hold_expires_at, e.confirmed_at,
         e.starts_at, e.ends_at, e.created_at
  FROM events e`;

export function toBooking(row) {
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

export function createBookingRepository(pool) {
  return {
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
