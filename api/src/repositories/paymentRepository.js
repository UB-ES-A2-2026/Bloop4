/**
 * Pagaments d'una reserva (US-08). Els imports es calculen a SQL (numeric) a partir dels preus
 * congelats a la reserva: mai arriben del navegador.
 */
const UNIQUE_VIOLATION = '23505';

// Import a cobrar: lloguer (preu/dia × quantitat × dies) + transport. La fiança no es cobra.
const AMOUNT_DUE = `
  SELECT (coalesce((SELECT sum(ei.daily_price * ei.quantity *
                               greatest(1, ceil(extract(epoch FROM (e.ends_at - e.starts_at)) / 86400))::int)
                    FROM event_items ei WHERE ei.event_id = e.id), 0)
          + coalesce((SELECT sum(t.price) FROM event_transport t WHERE t.event_id = e.id), 0))::numeric(12,2) AS amount,
         coalesce((SELECT min(ei.currency) FROM event_items ei WHERE ei.event_id = e.id), 'EUR') AS currency
  FROM events e WHERE e.id = $1`;

const PAYMENT = `
  SELECT p.id, p.event_id, p.provider, p.provider_ref, p.checkout_url, p.charge_ref, p.customer_ref,
         p.amount, p.currency, (p.amount * 100)::bigint AS amount_minor, p.status, p.receipt_number,
         p.failure_reason, p.created_at, p.paid_at
  FROM payments p`;

function toPayment(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    provider: row.provider,
    ref: row.provider_ref,
    checkoutUrl: row.checkout_url,
    chargeRef: row.charge_ref,
    customerRef: row.customer_ref,
    amount: row.amount,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    status: row.status,
    receiptNumber: row.receipt_number,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export function createPaymentRepository(pool) {
  return {
    /** Import a cobrar d'una reserva: { amount: '205.00', amountMinor: 20500, currency }. */
    async amountDue(eventId) {
      const { rows } = await pool.query(`SELECT a.amount, (a.amount * 100)::bigint AS amount_minor, a.currency FROM (${AMOUNT_DUE}) a`, [eventId]);
      return { amount: rows[0].amount, amountMinor: Number(rows[0].amount_minor), currency: rows[0].currency };
    },

    /** Pagament en curs de la reserva, o null. */
    async findPending(eventId) {
      const { rows } = await pool.query(`${PAYMENT} WHERE p.event_id = $1 AND p.status = 'pending'`, [eventId]);
      return rows[0] ? toPayment(rows[0]) : null;
    },

    /** Últim pagament de la reserva (el completat, si n'hi ha), o null. */
    async findLatest(eventId) {
      const { rows } = await pool.query(
        `${PAYMENT} WHERE p.event_id = $1
         ORDER BY (p.status IN ('succeeded', 'refunded')) DESC, p.created_at DESC LIMIT 1`,
        [eventId],
      );
      return rows[0] ? toPayment(rows[0]) : null;
    },

    async findByRef(provider, ref) {
      const { rows } = await pool.query(`${PAYMENT} WHERE p.provider = $1 AND p.provider_ref = $2`, [provider, ref]);
      return rows[0] ? toPayment(rows[0]) : null;
    },

    /**
     * Desa un pagament en curs. Retorna null si la reserva ja en té un (dues peticions alhora):
     * qui crida ha de fer servir el que ja existeix.
     */
    async create({ id, eventId, provider, ref, checkoutUrl, amount, currency }) {
      try {
        await pool.query(
          `INSERT INTO payments (id, event_id, provider, provider_ref, checkout_url, amount, currency)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, eventId, provider, ref, checkoutUrl, amount, currency],
        );
      } catch (err) {
        if (err.code === UNIQUE_VIOLATION) return null;
        throw err;
      }
      return this.findByRef(provider, ref);
    },

    /**
     * Registra un avís de la passarel·la. false si ja s'havia rebut (no s'ha de tornar a processar).
     */
    async recordWebhookEvent(provider, eventRef) {
      const { rowCount } = await pool.query(
        'INSERT INTO payment_webhook_events (provider, event_ref) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [provider, eventRef],
      );
      return rowCount === 1;
    },

    /** Marca el pagament com a cobrat i li assigna el número de comprovant. false si ja no estava en curs. */
    async markSucceeded(paymentId, { chargeRef, customerRef }) {
      const { rowCount } = await pool.query(
        `UPDATE payments
         SET status = 'succeeded', paid_at = now(), charge_ref = $2, customer_ref = $3,
             receipt_number = 'R-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('receipt_number_seq')::text, 6, '0')
         WHERE id = $1 AND status = 'pending'`,
        [paymentId, chargeRef, customerRef],
      );
      return rowCount === 1;
    },

    /** Tanca un pagament en curs sense cobrar: 'failed' (rebutjat) o 'cancelled' (caducat). */
    async markClosed(paymentId, status, reason = null) {
      const { rowCount } = await pool.query(
        "UPDATE payments SET status = $2, failure_reason = $3 WHERE id = $1 AND status = 'pending'",
        [paymentId, status, reason],
      );
      return rowCount === 1;
    },

    async markRefunded(paymentId, reason) {
      await pool.query("UPDATE payments SET status = 'refunded', failure_reason = $2 WHERE id = $1 AND status = 'succeeded'", [paymentId, reason]);
    },

    /** Pagaments en curs de reserves que ja no estan pendents de pagament (bloqueig caducat o cancel·lat). */
    async findStale() {
      const { rows } = await pool.query(
        `${PAYMENT} JOIN events e ON e.id = p.event_id WHERE p.status = 'pending' AND e.status <> 'pending_payment'`,
      );
      return rows.map(toPayment);
    },

    /** Client de la reserva, per enviar-li el comprovant: { email, fullName, bookingNumber }. */
    async findCustomer(eventId) {
      const { rows } = await pool.query(
        'SELECT u.email, u.full_name, e.booking_number FROM events e JOIN users u ON u.id = e.customer_id WHERE e.id = $1',
        [eventId],
      );
      return rows[0] ? { email: rows[0].email, fullName: rows[0].full_name, bookingNumber: rows[0].booking_number } : null;
    },
  };
}
