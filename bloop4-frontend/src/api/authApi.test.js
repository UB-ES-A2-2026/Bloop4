import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMe, login, logout } from './authApi';

function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('authApi', () => {
  it('login fa un POST amb el cos en JSON', async () => {
    const fetchMock = mockFetch(200, { data: { id: 'u1' } });
    await expect(login({ email: 'a@example.com', password: 'x' })).resolves.toEqual({ id: 'u1' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ email: 'a@example.com', password: 'x' });
  });

  it('fetchMe retorna null si no hi ha sessió (401)', async () => {
    mockFetch(401, { error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión' } });
    await expect(fetchMe()).resolves.toBeNull();
  });

  it('logout accepta una resposta 204 sense cos', async () => {
    mockFetch(204, undefined);
    await expect(logout()).resolves.toBeNull();
  });
});
