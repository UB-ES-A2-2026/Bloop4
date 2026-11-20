import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import LocationSharing, { LOCATION_SEND_MS } from './LocationSharing';
import { sendLocation } from '../api/riderApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/riderApi', () => ({ sendLocation: vi.fn() }));

/** Geolocalització falsa: el test decideix quan arriba una posició o un error. */
function fakeGeolocation() {
  const geo = { watchers: [], cleared: [] };
  geo.watchPosition = vi.fn((ok, fail) => {
    geo.watchers.push({ ok, fail });
    return geo.watchers.length;
  });
  geo.clearWatch = vi.fn((id) => geo.cleared.push(id));
  geo.emit = (latitude, longitude, accuracy = 10) => geo.watchers.at(-1).ok({ coords: { latitude, longitude, accuracy } });
  geo.fail = (code) => geo.watchers.at(-1).fail({ code });
  return geo;
}
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

beforeEach(() => {
  vi.useFakeTimers();
  sendLocation.mockReset().mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

describe('LocationSharing', () => {
  it('avisa que comparteix la ubicació i l\'envia com a molt cada 10 s', async () => {
    const geo = fakeGeolocation();
    render(<LocationSharing serviceId="s1" geolocation={geo} />);
    expect(screen.getByRole('status').textContent).toBe('Buscando tu ubicación…');

    await act(async () => geo.emit(39.47, -0.37));
    expect(screen.getByRole('status').textContent).toMatch(/Estás compartiendo tu ubicación con el cliente/);
    expect(sendLocation).toHaveBeenCalledWith('s1', { latitude: 39.47, longitude: -0.37, accuracy: 10 });

    await act(async () => geo.emit(39.48, -0.37));
    expect(sendLocation).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(LOCATION_SEND_MS); });
    expect(sendLocation).toHaveBeenCalledTimes(2);
    expect(sendLocation).toHaveBeenLastCalledWith('s1', { latitude: 39.48, longitude: -0.37, accuracy: 10 });
  });

  it('si el rider no dona permís, ho explica i no envia res', async () => {
    const geo = fakeGeolocation();
    render(<LocationSharing serviceId="s1" geolocation={geo} />);
    await act(async () => geo.fail(1));
    expect(screen.getByRole('status').textContent).toMatch(/No has dado permiso/);
    expect(sendLocation).not.toHaveBeenCalled();
  });

  it('sense geolocalització al dispositiu ho diu', () => {
    render(<LocationSharing serviceId="s1" geolocation={undefined} />);
    expect(screen.getByRole('status').textContent).toMatch(/no puede obtener tu ubicación/);
  });

  it('si el lliurament ja no està en curs, deixa d\'enviar-la; en desmuntar-se, para de llegir-la', async () => {
    const geo = fakeGeolocation();
    sendLocation.mockImplementation(async () => {
      throw new ApiRequestError('La ubicación solo se comparte mientras la entrega está en curso', { status: 409 });
    });
    const { unmount } = render(<LocationSharing serviceId="s1" geolocation={geo} />);
    await act(async () => geo.emit(39.47, -0.37));
    await flush();
    expect(screen.getByRole('status').textContent).toMatch(/hemos dejado de compartir/);
    await act(async () => { await vi.advanceTimersByTimeAsync(LOCATION_SEND_MS * 3); });
    expect(sendLocation).toHaveBeenCalledTimes(1);

    unmount();
    expect(geo.clearWatch).toHaveBeenCalledWith(1);
  });
});
