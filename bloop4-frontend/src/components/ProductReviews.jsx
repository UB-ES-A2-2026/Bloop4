import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createReview, fetchReviewEligibility, fetchReviews, hideReview } from '../api/reviewApi';
import { fetchProduct } from '../api/catalogApi';
import { formatDateTime } from '../lib/dates';

export const MAX_COMMENT = 1000;
const ratingFormat = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Estrelles plenes i buides per a una puntuació entera (1–5). */
const stars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

const NOT_ALLOWED = {
  NOT_RENTED: 'Solo pueden valorar este producto los clientes que lo han alquilado.',
  NOT_FINISHED: 'Podrás valorarlo cuando termine tu reserva y se recoja el material.',
  ALREADY_REVIEWED: 'Ya has valorado este producto. ¡Gracias!',
};
// Una valoració per reserva: si en té una altra amb el producte que encara no ha acabat.
const REVIEW_AGAIN = ' Podrás volver a valorarlo cuando termine tu otra reserva con él.';

function ReviewForm({ productId, bookings, onCreated }) {
  const [bookingId, setBookingId] = useState(bookings[0].bookingId);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!rating) return setError('Elige una puntuación de 1 a 5 estrellas.');
    setSending(true);
    setError(null);
    try {
      onCreated(await createReview(productId, { bookingId, rating, comment: comment.trim() }));
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate aria-labelledby="review-form-title">
      <h3 id="review-form-title" className="detail__subtitle">Valora este producto</h3>
      {bookings.length > 1 && (
        <label className="form__field">
          <span className="form__label">Reserva</span>
          <select className="form__input" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            {bookings.map((b) => (
              <option key={b.bookingId} value={b.bookingId}>
                {b.bookingNumber}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="review-form__stars" role="radiogroup" aria-label="Puntuación">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`review-form__star${n <= rating ? ' review-form__star--on' : ''}`}>
            <input
              type="radio"
              name="rating"
              value={n}
              checked={rating === n}
              onChange={() => setRating(n)}
              className="visually-hidden"
              aria-label={n === 1 ? '1 estrella' : `${n} estrellas`}
            />
            <span aria-hidden="true">★</span>
          </label>
        ))}
      </div>
      <div className="form__field">
        <label className="form__label" htmlFor="review-comment">
          Comentario (opcional)
        </label>
        <textarea
          id="review-comment"
          className="form__input"
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-describedby="review-comment-count"
        />
        <span id="review-comment-count" className="form__hint">
          {comment.length}/{MAX_COMMENT}
        </span>
      </div>
      {error && <p className="form__error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={sending}>
        {sending ? 'Publicando…' : 'Publicar valoración'}
      </button>
    </form>
  );
}

/**
 * Valoracions d'un producte a la fitxa: mitjana, comentaris (els més recents primer, amb
 * «Cargar más») i el formulari si el client pot valorar-lo. L'administrador pot ocultar-ne.
 */
export default function ProductReviews({ product }) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin');
  const [summary, setSummary] = useState(product.rating ?? { average: null, count: 0 });
  const [state, setState] = useState({ reviews: [], page: 0, totalPages: 0, status: 'loading', error: null });
  const [eligibility, setEligibility] = useState(null);
  const [message, setMessage] = useState(null);

  const loadPage = useCallback(
    async (page) => {
      setState((s) => ({ ...s, status: 'loading' }));
      try {
        const { reviews, pagination } = await fetchReviews(product.id, page);
        setState((s) => ({
          reviews: page === 1 ? reviews : [...s.reviews, ...reviews],
          page,
          totalPages: pagination.totalPages,
          totalItems: pagination.totalItems,
          status: 'success',
          error: null,
        }));
      } catch (error) {
        setState((s) => ({ ...s, status: 'error', error }));
      }
    },
    [product.id],
  );

  useEffect(() => {
    loadPage(1);
    const controller = new AbortController();
    fetchReviewEligibility(product.id, { signal: controller.signal })
      .then(setEligibility)
      .catch(() => {});
    return () => controller.abort();
  }, [product.id, user?.id, loadPage]);

  /** La mitjana la calcula l'API: després d'un canvi es torna a demanar la fitxa i la primera pàgina. */
  async function refresh() {
    loadPage(1);
    try {
      setSummary((await fetchProduct(product.id)).rating);
    } catch {
      // Si falla, es manté el resum anterior fins a la propera visita.
    }
  }

  function created() {
    setMessage('¡Gracias! Tu valoración ya está publicada.');
    refresh();
    // Si té una altra reserva finalitzada sense valorar, el formulari hi torna a sortir.
    fetchReviewEligibility(product.id)
      .then(setEligibility)
      .catch(() => setEligibility({ canReview: false, reason: 'ALREADY_REVIEWED', bookings: [] }));
  }

  async function hide(review) {
    try {
      await hideReview(review.id);
      refresh();
    } catch (err) {
      setMessage(err.message);
    }
  }

  const average = summary.average === null || summary.average === undefined ? null : Number(summary.average);
  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="detail__subtitle">Valoraciones</h2>
      {summary.count === 0 ? (
        <p className="reviews__empty">Todavía sin valoraciones</p>
      ) : (
        <p className="reviews__summary">
          {average !== null && (
            <>
              <strong className="reviews__average">{ratingFormat.format(average)}</strong> de 5 ·{' '}
            </>
          )}
          {summary.count === 1 ? '1 valoración' : `${summary.count} valoraciones`}
        </p>
      )}

      {state.reviews.length > 0 && (
        <ul className="reviews__list">
          {state.reviews.map((review) => (
            <li key={review.id} className="reviews__item">
              <span className="reviews__stars" aria-label={`${review.rating} de 5 estrellas`}>
                {stars(review.rating)}
              </span>
              <span className="form__hint">
                {review.author} · {formatDateTime(review.createdAt)}
              </span>
              {/* El comentari es mostra sempre com a text: React n'escapa el contingut. */}
              {review.comment && <p className="reviews__comment">{review.comment}</p>}
              {isAdmin && (
                <button type="button" className="link-button" onClick={() => hide(review)}>
                  Ocultar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {state.status === 'error' && (
        <p className="form__error" role="alert">
          No se pudieron cargar las valoraciones.{' '}
          <button type="button" className="link-button" onClick={() => loadPage(state.page + 1 || 1)}>
            Reintentar
          </button>
        </p>
      )}
      {state.status === 'success' && state.page < state.totalPages && (
        <button type="button" className="btn-outline" onClick={() => loadPage(state.page + 1)}>
          Cargar más
        </button>
      )}

      {message && <p className="booking__notice booking__notice--ok" role="status">{message}</p>}
      {eligibility?.canReview && (
        // La clau canvia amb les reserves pendents: després de valorar-ne una, el formulari es
        // torna a crear net per a la següent.
        <ReviewForm
          key={eligibility.bookings.map((b) => b.bookingId).join()}
          productId={product.id}
          bookings={eligibility.bookings}
          onCreated={created}
        />
      )}
      {eligibility?.reason === 'LOGIN' && (
        <p className="form__hint">
          <Link to="/iniciar-sesion">Inicia sesión</Link> para valorar este producto si lo has alquilado.
        </p>
      )}
      {eligibility && !eligibility.canReview && NOT_ALLOWED[eligibility.reason] && !message && (
        <p className="form__hint">
          {NOT_ALLOWED[eligibility.reason]}
          {eligibility.reviewAgainLater && REVIEW_AGAIN}
        </p>
      )}
    </section>
  );
}
