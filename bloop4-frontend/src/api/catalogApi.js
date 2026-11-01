/**
 * Client HTTP de l'API del catàleg. A Docker, Nginx serveix el frontend i
 * redirigeix /api a l'API; en desenvolupament ho fa el proxy de Vite.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiRequestError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiRequestError('No se pudo conectar con el servidor');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiRequestError(body?.error?.message ?? `Error HTTP ${response.status}`, {
      status: response.status,
      code: body?.error?.code,
    });
  }
  if (!Array.isArray(body?.data)) {
    throw new ApiRequestError('Respuesta inesperada del servidor', { status: response.status });
  }
  return body;
}

/** @returns {Promise<Array<{ id, parentId, name, slug, sortOrder, productCount }>>} */
export async function fetchCategories({ signal } = {}) {
  const { data } = await request('/categories', { signal });
  return data;
}

/** @returns {Promise<{ data: object[], pagination: { page, pageSize, totalItems, totalPages } }>} */
export function fetchProducts({ categoryIds = [], q = '', page = 1, pageSize = 24 } = {}, { signal } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (categoryIds.length > 0) params.set('categoryId', categoryIds.join(','));
  if (q) params.set('q', q);
  return request(`/products?${params}`, { signal });
}
