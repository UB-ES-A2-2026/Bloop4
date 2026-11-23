import { Router } from 'express';
import { ApiError, notFoundError, unauthenticatedError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REVIEWS_PAGE_SIZE = 10;
export const MAX_COMMENT = 1000;

const NOT_ALLOWED = {
  NOT_RENTED: 'Solo puedes valorar productos que hayas alquilado',
  NOT_FINISHED: 'Podrás valorar este producto cuando termine tu reserva y se recoja el material',
  ALREADY_REVIEWED: 'Ya has valorado este producto con esta reserva',
};

function productId(req) {
  if (!UUID.test(req.params.id)) throw validationError('"id" debe ser un UUID válido', { field: 'id' });
  return req.params.id.toLowerCase();
}

function positiveInt(raw, fallback, max) {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) throw validationError(`Debe ser un número entero entre 1 y ${max}`);
  return n;
}

/**
 * GET /api/products/:id/reviews (públic), GET /api/products/:id/reviews/eligibility i
 * POST /api/products/:id/reviews (client amb una reserva finalitzada del producte).
 */
export function reviewsRouter({ reviewRepository, catalogRepository }) {
  const router = Router();

  async function existingProduct(req) {
    const id = productId(req);
    if (!(await catalogRepository.getProduct(id))) throw notFoundError('Producto no encontrado');
    return id;
  }

  router.get('/products/:id/reviews', async (req, res) => {
    const id = await existingProduct(req);
    const page = positiveInt(req.query.page, 1, 10_000);
    const pageSize = positiveInt(req.query.pageSize, REVIEWS_PAGE_SIZE, 50);
    const { reviews, total } = await reviewRepository.list(id, { limit: pageSize, offset: (page - 1) * pageSize });
    res.json({ data: reviews, pagination: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) } });
  });

  // Si el client de la sessió pot valorar el producte i amb quina reserva.
  router.get('/products/:id/reviews/eligibility', async (req, res) => {
    const id = await existingProduct(req);
    if (!req.user) return res.json({ data: { canReview: false, reason: 'LOGIN', bookings: [] } });
    if (!req.user.roles.includes('customer')) return res.json({ data: { canReview: false, reason: 'NOT_RENTED', bookings: [] } });
    const { bookings, reason, reviewAgainLater } = await reviewRepository.eligibility(id, req.user.id);
    res.json({ data: { canReview: bookings.length > 0, reason, reviewAgainLater, bookings } });
  });

  router.post('/products/:id/reviews', async (req, res, next) => {
    if (!req.user) throw unauthenticatedError('Inicia sesión para valorar este producto');
    next();
  }, requireRole('customer'), requireActive, async (req, res) => {
    const id = await existingProduct(req);
    const { bookingId, rating } = req.body ?? {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw validationError('La puntuación debe ser un número entero de 1 a 5', { field: 'rating' });
    }
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
    if (comment.length > MAX_COMMENT) throw validationError(`El comentario puede tener como máximo ${MAX_COMMENT} caracteres`, { field: 'comment' });
    if (typeof bookingId !== 'string' || !UUID.test(bookingId)) throw validationError('Indica la reserva', { field: 'bookingId' });

    // Es decideix per la reserva concreta: si és del client i té el producte, si ha acabat i si
    // ja s'hi ha valorat (una valoració per client, producte i reserva).
    const { history } = await reviewRepository.eligibility(id, req.user.id);
    const booking = history.find((b) => b.bookingId === bookingId.toLowerCase());
    const why = !booking ? 'NOT_RENTED' : !booking.finished ? 'NOT_FINISHED' : booking.reviewed ? 'ALREADY_REVIEWED' : null;
    if (why) {
      throw new ApiError(why === 'ALREADY_REVIEWED' ? 409 : 403, why === 'ALREADY_REVIEWED' ? 'CONFLICT' : 'FORBIDDEN', NOT_ALLOWED[why], { reason: why });
    }
    const review = await reviewRepository.create({ productId: id, bookingId: bookingId.toLowerCase(), customerId: req.user.id, rating, comment: comment || null });
    res.status(201).json({ data: review });
  });

  return router;
}

/** POST /api/admin/reviews/:id/hide: un administrador oculta una valoració ofensiva o inadequada. */
export function adminReviewsRouter({ reviewRepository }) {
  const router = Router();
  router.post('/reviews/:id/hide', requireRole('admin'), requireActive, async (req, res) => {
    if (!UUID.test(req.params.id)) throw validationError('"id" debe ser un UUID válido', { field: 'id' });
    if (!(await reviewRepository.hide(req.params.id.toLowerCase(), req.user.id))) throw notFoundError('Valoración no encontrada');
    res.status(204).end();
  });
  return router;
}
