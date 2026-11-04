/**
 * Client HTTP comú de l'API. A Docker, Nginx serveix el frontend i redirigeix /api a l'API;
 * en desenvolupament ho fa el proxy de Vite. Com que és el mateix origen, el navegador envia
 * la cookie de sessió sola: el frontend no guarda mai cap token.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiRequestError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * `shape`: 'list' si `data` ha de ser una llista, 'object' si ha de ser un objecte i
 * 'none' si la resposta no té cos (204). `body` s'envia com a JSON.
 */
export async function request(path, { signal, shape = 'list', method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiRequestError('No se pudo conectar con el servidor');
  }

  const json = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiRequestError(json?.error?.message ?? `Error HTTP ${response.status}`, {
      status: response.status,
      code: json?.error?.code,
      details: json?.error?.details,
    });
  }
  if (shape === 'none') return null;
  const valid = shape === 'list' ? Array.isArray(json?.data) : json?.data !== null && typeof json?.data === 'object';
  if (!valid) {
    throw new ApiRequestError('Respuesta inesperada del servidor', { status: response.status });
  }
  return json;
}
