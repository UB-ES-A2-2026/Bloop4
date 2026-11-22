/** Client de les valoracions de productes (US-04). */
import { request } from './http';

export const REVIEWS_PAGE_SIZE = 10;

/** Pàgina de valoracions visibles: { reviews, pagination }. */
export async function fetchReviews(productId, page = 1, { signal } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(REVIEWS_PAGE_SIZE) });
  const json = await request(`/products/${encodeURIComponent(productId)}/reviews?${params}`, { signal });
  return { reviews: json.data, pagination: json.pagination };
}

/** Si l'usuari pot valorar el producte: { canReview, reason, bookings }. */
export async function fetchReviewEligibility(productId, { signal } = {}) {
  const { data } = await request(`/products/${encodeURIComponent(productId)}/reviews/eligibility`, { signal, shape: 'object' });
  return data;
}

export async function createReview(productId, { bookingId, rating, comment }) {
  const { data } = await request(`/products/${encodeURIComponent(productId)}/reviews`, {
    method: 'POST',
    body: { bookingId, rating, comment: comment || undefined },
    shape: 'object',
  });
  return data;
}

/** Administrador: oculta una valoració. */
export function hideReview(reviewId) {
  return request(`/admin/reviews/${encodeURIComponent(reviewId)}/hide`, { method: 'POST', shape: 'none' });
}
