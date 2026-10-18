import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, fetchCategories, fetchProducts } from './catalogApi';

function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchProducts', () => {
  it('demana la pàgina indicada i retorna data i pagination', async () => {
    const body = { data: [], pagination: { page: 2, pageSize: 24, totalItems: 30, totalPages: 2 } };
    const fetchMock = mockFetch(200, body);

    await expect(fetchProducts({ page: 2 })).resolves.toEqual(body);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/products?page=2&pageSize=24');
  });

  it('envia les categories separades per comes', async () => {
    const fetchMock = mockFetch(200, { data: [], pagination: {} });

    await fetchProducts({ categoryIds: ['a', 'b'] });
    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost');
    expect(url.searchParams.get('categoryId')).toBe('a,b');
  });

  it('no envia categoryId si no hi ha filtre', async () => {
    const fetchMock = mockFetch(200, { data: [], pagination: {} });

    await fetchProducts();
    expect(fetchMock.mock.calls[0][0]).not.toContain('categoryId');
  });
});

describe('fetchCategories', () => {
  it('retorna directament la llista de data', async () => {
    const categories = [{ id: 'c1', name: 'Sonido' }];
    mockFetch(200, { data: categories });

    await expect(fetchCategories()).resolves.toEqual(categories);
  });
});

describe('errors', () => {
  it('converteix un error de l\'API en ApiRequestError amb status, code i missatge', async () => {
    mockFetch(400, { error: { code: 'VALIDATION_ERROR', message: '"page" debe ser un entero' } });

    const error = await fetchProducts().catch((err) => err);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: '"page" debe ser un entero' });
  });

  it('fa servir el codi HTTP si la resposta d\'error no és JSON', async () => {
    mockFetch(502, undefined);

    await expect(fetchProducts()).rejects.toMatchObject({ status: 502, message: 'Error HTTP 502' });
  });

  it('avisa si no es pot connectar amb el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchProducts()).rejects.toMatchObject({
      name: 'ApiRequestError',
      message: 'No se pudo conectar con el servidor',
    });
  });

  it('rebutja una resposta 200 sense llista a data', async () => {
    mockFetch(200, { items: [] });

    await expect(fetchCategories()).rejects.toMatchObject({ message: 'Respuesta inesperada del servidor' });
  });

  it('propaga l\'AbortError tal qual perquè qui avorta el pugui ignorar', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(fetchProducts()).rejects.toBe(abortError);
  });
});
