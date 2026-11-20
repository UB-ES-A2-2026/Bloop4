import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import BookingPayment from './BookingPayment';
import { fetchPayment } from '../api/bookingApi';
import { ApiRequestError } from '../api/http';
import { makeBooking } from '../test/fixtures';

vi.mock('../api/bookingApi', () => ({ fetchPayment: vi.fn(), startPayment: vi.fn() }));

const NOW = new Date('2030-01-01T10:00:00Z');

/** Com la pàgina de la reserva: `reload` torna a llegir la reserva amb `next()`. */
function Page({ initial, next }) {
  const [booking, setBooking] = useState(initial);
  const reload = useCallback(() => {
    next().then(setBooking);
  }, [next]);
  return <BookingPayment booking={booking} reload={reload} />;
}

function renderPayment({ booking = makeBooking(), next = vi.fn(async () => booking), query = '' } = {}) {
  render(
    <MemoryRouter initialEntries={[`/reservas/b1${query}`]}>
      <Page initial={booking} next={next} />
    </MemoryRouter>,
  );
  return next;
}

beforeEach(() => {
  fetchPayment.mockReset().mockResolvedValue({ status: 'none', deposit: null });
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('BookingPayment (US-08)', () => {
  it('una reserva pendent ofereix pagar; quan el bloqueig caduca, ja no', async () => {
    renderPayment({ booking: makeBooking({ holdExpiresAt: '2030-01-01T10:00:02Z' }) });
    const button = await screen.findByRole('button', { name: 'Pagar con tarjeta' });
    expect(button.disabled).toBe(false);
    await waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('button', { name: 'Pagar con tarjeta' }).disabled).toBe(true);
  });

  it('en tornar de la passarel·la consulta l\'estat fins que la reserva queda confirmada', async () => {
    const next = vi.fn(async () => makeBooking({ status: 'confirmed', holdExpiresAt: null }));
    fetchPayment
      .mockResolvedValueOnce({ status: 'pending', deposit: null })
      .mockResolvedValue({ status: 'succeeded', amount: '205.00', currency: 'EUR', receiptNumber: 'R-2030-000001', paidAt: '2030-01-01T10:05:00Z', deposit: null });
    renderPayment({ query: '?pago=ok', next });

    expect(await screen.findByText('Estamos confirmando tu pago…')).toBeTruthy();
    // Hi ha d'haver el compte enrere i la consulta periòdica abans d'avançar el rellotge.
    await waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(1));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(await screen.findByText('Comprobante')).toBeTruthy();
    expect(screen.getByText('Comprobante').nextSibling.textContent).toBe('R-2030-000001');
    // Un cop confirmada, deixa de consultar.
    const calls = next.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(next.mock.calls.length).toBe(calls);
  });

  it('si l\'estat del pagament no es pot llegir, es pot pagar igualment', async () => {
    fetchPayment.mockRejectedValue(new ApiRequestError('No se pudo conectar con el servidor'));
    renderPayment();
    expect(await screen.findByRole('button', { name: 'Pagar con tarjeta' })).toBeTruthy();
  });
});
