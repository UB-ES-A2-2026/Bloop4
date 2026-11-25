import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelBooking,
  checkoutCart,
  completeMockPayment,
  fetchBooking,
  fetchBookings,
  fetchLocations,
  fetchPayment,
  fetchTracking,
  startPayment,
} from './bookingApi';

function mockFetch(status, body) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => body });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const call = (fetchMock, i = 0) => {
  const [url, options] = fetchMock.mock.calls[i];
  return { url, method: options.method, headers: options.headers, body: options.body && JSON.parse(options.body) };
};

afterEach(() => vi.unstubAllGlobals());

describe('bookingApi (fonaments)', () => {
  it('el checkout envia la clau d\'idempotència a la capçalera', async () => {
    const fetchMock = mockFetch(201, { data: { id: 'b1' } });
    await expect(checkoutCart('clau-0001')).resolves.toEqual({ id: 'b1' });
    const { url, method, headers } = call(fetchMock);
    expect([url, method, headers['Idempotency-Key']]).toEqual(['/api/cart/checkout', 'POST', 'clau-0001']);
  });

  it('llegeix les reserves, una reserva, el pagament, el seguiment i les ubicacions', async () => {
    const fetchMock = mockFetch(200, { data: [] });
    await fetchBookings();
    mockFetch(200, { data: { id: 'b 1' } });
    await fetchBooking('b 1');
    await fetchPayment('b 1');
    await fetchTracking('b 1');
    expect(call(fetchMock).url).toBe('/api/bookings');
    const urls = fetch.mock.calls.map(([url]) => url);
    expect(urls).toEqual(['/api/bookings/b%201', '/api/bookings/b%201/payment', '/api/bookings/b%201/tracking']);
    const list = mockFetch(200, { data: [] });
    await expect(fetchLocations('b1')).resolves.toEqual([]);
    expect(call(list).url).toBe('/api/bookings/b1/locations');
  });

  it('cancel·lar, pagar i el pagament simulat són POST', async () => {
    let fetchMock = mockFetch(204, undefined);
    await expect(cancelBooking('b1')).resolves.toBeNull();
    expect(call(fetchMock)).toMatchObject({ url: '/api/bookings/b1/cancel', method: 'POST' });

    fetchMock = mockFetch(201, { data: { checkoutUrl: '/pago-simulado?ref=x' } });
    await expect(startPayment('b1')).resolves.toEqual({ checkoutUrl: '/pago-simulado?ref=x' });
    expect(call(fetchMock)).toMatchObject({ url: '/api/bookings/b1/payment', method: 'POST' });

    fetchMock = mockFetch(200, { data: { result: 'succeeded' } });
    await completeMockPayment('mock_cs_1', '4242424242424242');
    expect(call(fetchMock)).toMatchObject({ url: '/api/payments/mock/complete', method: 'POST', body: { ref: 'mock_cs_1', cardNumber: '4242424242424242' } });
  });
});
