/**
 * Valoracions de productes (US-04). Només en pot deixar el client d'una reserva finalitzada que
 * contenia el producte, una per reserva. Les ocultes per l'administrador no surten enlloc.
 */
import { conflictError } from '../errors.js';

const UNIQUE_VIOLATION = '23505';

/** "Laura Cliente" → "Laura C.": el nom que es mostra al costat d'un comentari. */
export function shortName(fullName) {
  const [first, second] = String(fullName).trim().split(/\s+/);
  return second ? `${first} ${second[0].toUpperCase()}.` : first;
}

function toReview(row) {
  return { id: row.id, rating: row.rating, comment: row.comment, author: shortName(row.full_name), createdAt: row.created_at };
}

export function createReviewRepository(pool) {
  return {
    /** Valoracions visibles del producte, de la més recent a la més antiga, paginades. */
    async list(productId, { limit, offset }) {
      const { rows } = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name, count(*) OVER ()::int AS total
         FROM reviews r JOIN users u ON u.id = r.customer_id
         WHERE r.product_id = $1 AND NOT r.hidden
         ORDER BY r.created_at DESC, r.id
         LIMIT $2 OFFSET $3`,
        [productId, limit, offset],
      );
      let total = rows[0]?.total;
      if (total === undefined) {
        // Pàgina buida: el total s'ha de comptar a part.
        const count = await pool.query('SELECT count(*)::int AS n FROM reviews WHERE product_id = $1 AND NOT hidden', [productId]);
        total = count.rows[0].n;
      }
      return { reviews: rows.map(toReview), total };
    },

    /**
     * Reserves del client amb les quals pot valorar el producte (finalitzades, amb el producte i
     * encara sense valorar: una valoració per reserva), i per què no pot si no n'hi ha cap.
     * Si ja l'ha valorat, el motiu és ALREADY_REVIEWED encara que tingui una altra reserva en curs
     * amb el producte; aleshores `reviewAgainLater` és true. `history` porta totes les seves
     * reserves amb el producte, per decidir sobre una reserva concreta.
     * @returns {{ bookings: object[], reason: null | 'NOT_RENTED' | 'NOT_FINISHED' | 'ALREADY_REVIEWED',
     *             reviewAgainLater: boolean, history: { bookingId, finished, reviewed }[] }}
     */
    async eligibility(productId, customerId) {
      const { rows } = await pool.query(
        `SELECT e.id, e.booking_number, e.ends_at, e.status,
                EXISTS (SELECT 1 FROM reviews r WHERE r.event_id = e.id AND r.product_id = $1 AND r.customer_id = $2) AS reviewed
         FROM events e JOIN event_items ei ON ei.event_id = e.id
         WHERE e.customer_id = $2 AND ei.product_id = $1 AND e.status IN ('confirmed', 'completed')
         ORDER BY e.ends_at DESC, e.id`,
        [productId, customerId],
      );
      const bookings = rows
        .filter((r) => r.status === 'completed' && !r.reviewed)
        .map((r) => ({ bookingId: r.id, bookingNumber: r.booking_number, endedAt: r.ends_at }));
      const ongoing = rows.some((r) => r.status !== 'completed');
      let reason = null;
      if (!bookings.length) {
        if (!rows.length) reason = 'NOT_RENTED';
        else if (rows.some((r) => r.reviewed)) reason = 'ALREADY_REVIEWED';
        else reason = 'NOT_FINISHED';
      }
      return {
        bookings,
        reason,
        reviewAgainLater: reason === 'ALREADY_REVIEWED' && ongoing,
        history: rows.map((r) => ({ bookingId: r.id, finished: r.status === 'completed', reviewed: r.reviewed })),
      };
    },

    /** Desa la valoració. La BD comprova que la reserva permet valorar; si ja n'hi ha una, 409. */
    async create({ productId, bookingId, customerId, rating, comment }) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO reviews (product_id, event_id, customer_id, rating, comment) VALUES ($1, $2, $3, $4, $5)
           RETURNING id, rating, comment, created_at, (SELECT full_name FROM users WHERE id = $3) AS full_name`,
          [productId, bookingId, customerId, rating, comment],
        );
        return toReview(rows[0]);
      } catch (err) {
        if (err.code === UNIQUE_VIOLATION) throw conflictError('Ya has valorado este producto para esta reserva');
        throw err;
      }
    },

    /**
     * Un administrador oculta una valoració: deixa de mostrar-se i de comptar a la mitjana.
     * @returns false si no existeix; ocultar-la dues vegades no fa res
     */
    async hide(reviewId, adminId) {
      const { rows } = await pool.query(
        `UPDATE reviews SET hidden = true, hidden_at = coalesce(hidden_at, now()), hidden_by = coalesce(hidden_by, $2)
         WHERE id = $1 RETURNING id`,
        [reviewId, adminId],
      );
      return rows.length > 0;
    },
  };
}
