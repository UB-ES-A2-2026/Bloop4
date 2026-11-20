import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import DeliveryTracking, { LOCATIONS_POLL_MS, ago } from './DeliveryTracking';
import { fetchLocations } from '../api/bookingApi';

vi.mock('../api/bookingApi', () => ({ fetchLocations: vi.fn() }));
// Leaflet no es pot dibuixar a jsdom: el mapa es substitueix per un element amb les dades.
vi.mock('./RiderMap', () => ({
  default: ({ latitude, longitude, label }) => <div data-testid="map">{`${label}: ${latitude}, ${longitude}`}</div>,
}));

const NOW = new Date('2030-06-15T08:00:00Z');
const delivery = (location, seller = 'Sonido Levante S.L.') => ({
  serviceId: seller, seller: { id: seller, legalName: seller }, timeWindow: {}, location,
});
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
/** Amb rellotge fals, findBy* no avança: es deixen resoldre la petició i el mapa (lazy) a mà. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await flush();
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(NOW);
  fetchLocations.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('DeliveryTracking', () => {
  it('mostra al mapa la posició del rider i fa quant s\'ha actualitzat', async () => {
    fetchLocations.mockResolvedValue([delivery({ latitude: 39.47, longitude: -0.37, accuracy: 10, recordedAt: '2030-06-15T07:59:35Z', stale: false })]);
    render(<DeliveryTracking bookingId="b1" />);
    await settle();
    expect(screen.getByTestId('map').textContent).toBe('Repartidor de Sonido Levante S.L.: 39.47, -0.37');
    expect(screen.getByText('Ubicación actualizada hace 25 s.')).toBeTruthy();
  });

  it('es torna a demanar cada 10 s i el mapa es mou', async () => {
    fetchLocations
      .mockResolvedValueOnce([delivery({ latitude: 39.47, longitude: -0.37, recordedAt: NOW.toISOString(), stale: false })])
      .mockResolvedValueOnce([delivery({ latitude: 39.48, longitude: -0.36, recordedAt: NOW.toISOString(), stale: false })]);
    render(<DeliveryTracking bookingId="b1" />);
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(LOCATIONS_POLL_MS); });
    await settle();
    expect(screen.getByTestId('map').textContent).toMatch(/39.48, -0.36/);
  });

  it('sense posició o amb una d\'antiga ho diu; cada lliurament té el seu mapa', async () => {
    fetchLocations.mockResolvedValue([
      delivery(null, 'Mobiliario Eventos Turia S.L.'),
      delivery({ latitude: 39.47, longitude: -0.37, recordedAt: '2030-06-15T07:55:00Z', stale: true }),
    ]);
    render(<DeliveryTracking bookingId="b1" />);
    await settle();
    expect(screen.getByText(/todavía no está disponible/)).toBeTruthy();
    expect(screen.getByText(/Hace un rato que no recibimos la ubicación/)).toBeTruthy();
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('sense cap lliurament en curs no mostra res', async () => {
    fetchLocations.mockResolvedValue([]);
    const { container } = render(<DeliveryTracking bookingId="b1" />);
    await flush();
    expect(container.textContent).toBe('');
  });

  it('ago() diu fa quant en segons, minuts o hores', () => {
    const now = NOW.getTime();
    expect(ago('2030-06-15T07:59:50Z', now)).toBe('hace 10 s');
    expect(ago('2030-06-15T07:57:00Z', now)).toBe('hace 3 min');
    expect(ago('2030-06-15T05:00:00Z', now)).toBe('hace 3 h');
  });
});
