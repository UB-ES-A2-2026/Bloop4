import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptService,
  completeService,
  deleteProofPhoto,
  fetchAvailableServices,
  fetchMyService,
  fetchMyServices,
  fetchProofPhotos,
  reportIncident,
  sendLocation,
  startService,
  uploadProofPhoto,
} from './riderApi';

function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const urls = (fetchMock) => fetchMock.mock.calls.map(([url, options]) => `${options.method} ${url}`);

afterEach(() => vi.unstubAllGlobals());

describe('riderApi (fonaments)', () => {
  it('llegeix els serveis disponibles, els d\'un dia, els propers i un servei', async () => {
    const list = mockFetch(200, { data: [] });
    await fetchAvailableServices();
    await fetchMyServices('2030-06-15');
    await fetchMyServices();
    await fetchProofPhotos('s1');
    const one = mockFetch(200, { data: { id: 's1' } });
    await expect(fetchMyService('s1')).resolves.toEqual({ id: 's1' });
    expect(urls(list)).toEqual([
      'GET /api/rider/services/available',
      'GET /api/rider/services?date=2030-06-15',
      'GET /api/rider/services',
      'GET /api/rider/services/s1/photos',
    ]);
    expect(urls(one)).toEqual(['GET /api/rider/services/s1']);
  });

  it('acceptar, iniciar, completar i registrar una incidència són POST amb el cos en JSON', async () => {
    const fetchMock = mockFetch(200, { data: { id: 's1' } });
    await acceptService('s1');
    await startService('s1');
    await completeService('s1', [{ eventItemId: 'i1', condition: 'correct' }]);
    await reportIncident('s1', { kind: 'other', description: 'Algo' });
    expect(urls(fetchMock)).toEqual([
      'POST /api/rider/services/s1/accept',
      'POST /api/rider/services/s1/start',
      'POST /api/rider/services/s1/complete',
      'POST /api/rider/services/s1/incident',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ items: [{ eventItemId: 'i1', condition: 'correct' }] });
  });

  it('una foto s\'envia com a FormData, sense Content-Type (el posa el navegador)', async () => {
    const fetchMock = mockFetch(201, { data: { id: 'p1' } });
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await uploadProofPhoto('s1', file, 'i1');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/rider/services/s1/photos');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('eventItemId')).toBe('i1');
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('esborrar una foto i enviar la ubicació no retornen cos', async () => {
    const fetchMock = mockFetch(204, undefined);
    await expect(deleteProofPhoto('s1', 'p1')).resolves.toBeNull();
    await expect(sendLocation('s1', { latitude: 39.47, longitude: -0.37 })).resolves.toBeNull();
    expect(urls(fetchMock)).toEqual(['DELETE /api/rider/services/s1/photos/p1', 'POST /api/rider/services/s1/location']);
  });
});
