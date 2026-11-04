/** Client de l'API del catàleg. Totes les peticions passen per `request()` de http.js. */
import { request } from './http';

export { ApiRequestError } from './http';

/** @returns {Promise<Array<{ id, parentId, name, slug, sortOrder, productCount }>>} */
export async function fetchCategories({ signal } = {}) {
  const { data } = await request('/categories', { signal });
  return data;
}

/** Fitxa completa d'un producte (amb descripció, fiança, assegurança, specs i imatges). */
export async function fetchProduct(id, { signal } = {}) {
  const { data } = await request(`/products/${encodeURIComponent(id)}`, { signal, shape: 'object' });
  return data;
}

/** @returns {Promise<{ data: object[], pagination: { page, pageSize, totalItems, totalPages } }>} */
export function fetchProducts({ categoryIds = [], q = '', page = 1, pageSize = 24 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (categoryIds.length > 0) params.set('categoryId', categoryIds.join(','));
  if (q) params.set('q', q);
  return request(`/products?${params}`, { signal });
}

/**
 * Disponibilitat d'un producte en [from, to) (Date). @returns { availableUnits, totalUnits,
 * billableDays, totalPrice, currency, suggestions: [{ from, to, availableUnits }] }
 */
export async function fetchAvailability(id, { from, to }, { signal } = {}) {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  const { data } = await request(`/products/${encodeURIComponent(id)}/availability?${params}`, { signal, shape: 'object' });
  return data;
}

/** @returns {Promise<string[]>} dies del mes ('AAAA-MM-DD') sense cap unitat lliure */
export async function fetchAvailabilityCalendar(id, month, { signal } = {}) {
  const { data } = await request(`/products/${encodeURIComponent(id)}/availability/calendar?month=${month}`, {
    signal,
    shape: 'object',
  });
  return data.unavailableDays;
}
