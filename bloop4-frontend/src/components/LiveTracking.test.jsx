import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LiveTracking from './LiveTracking';
import { fetchTracking } from '../api/bookingApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/bookingApi', () => ({ fetchTracking: vi.fn() }));

const delivery = {
  id: 'd1', type: 'delivery', status: 'in_transit', delayed: false,
  timeWindow: { startsAt: '2030-06-15T06:00:00.000Z', endsAt: '2030-06-15T08:00:00.000Z' },
  history: [{ status: 'in_transit', at: '2030-06-15T06:30:00.000Z' }],
};
const group = { seller: { id: 's1', legalName: 'Sonido' }, phase: 'delivery_in_transit', delivery, pickup: null };
const renderTracking = () => render(<MemoryRouter><LiveTracking bookingId="b1" /></MemoryRouter>);

// Rellotge fals per a la consulta periòdica (com la resta de proves que la fan servir).
beforeEach(() => {
  fetchTracking.mockReset();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});
afterEach(() => vi.useRealTimers());

describe('LiveTracking (US-09)', () => {
  it('mostra el seguiment de la reserva', async () => {
    fetchTracking.mockResolvedValue({ checkedAt: '2030-06-15T06:31:00.000Z', sellers: [group] });
    renderTracking();
    expect(await screen.findByRole('region', { name: 'Seguimiento de Sonido' })).toBeTruthy();
    expect(fetchTracking).toHaveBeenCalledWith('b1', expect.anything());
  });

  it('si el seguiment no es pot llegir, ho diu sense amagar la resta de la reserva', async () => {
    fetchTracking.mockRejectedValue(new ApiRequestError('No se pudo conectar con el servidor'));
    renderTracking();
    expect((await screen.findByRole('status')).textContent).toMatch(/El seguimiento no está disponible/);
  });
});
