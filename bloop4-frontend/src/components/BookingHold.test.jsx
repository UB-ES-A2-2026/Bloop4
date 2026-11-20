import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookingHold from './BookingHold';
import { cancelBooking } from '../api/bookingApi';
import { makeBooking } from '../test/fixtures';

vi.mock('../api/bookingApi', () => ({ cancelBooking: vi.fn() }));

const NOW = new Date('2030-01-01T10:00:00Z');

function renderHold(booking) {
  return render(
    <MemoryRouter initialEntries={['/reservas/b1']}>
      <Routes>
        <Route path="/reservas/:id" element={<BookingHold booking={booking} />} />
        <Route path="/reserva" element={<p>Cistella</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cancelBooking.mockReset();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

/**
 * El compte enrere crea el seu setInterval en un efecte, que pot arribar una mica després que la
 * pàgina ja es vegi (sobretot si la màquina va carregada). S'espera que existeixi abans d'avançar
 * el rellotge fals; si no, el temps avançaria sense cap interval que el comptés.
 */
const timersReady = () => waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));

describe('BookingHold (US-12)', () => {
  it('una reserva pendent mostra el compte enrere del bloqueig', async () => {
    renderHold(makeBooking({ holdExpiresAt: '2030-01-01T10:14:05Z' }));

    expect((await screen.findByRole('timer')).textContent).toBe('14:05');
    await timersReady();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole('timer').textContent).toBe('14:00');
  });

  it('quan el bloqueig caduca avisa que cal tornar a comprovar la disponibilitat', async () => {
    renderHold(makeBooking({ holdExpiresAt: '2030-01-01T10:00:02Z' }));

    await screen.findByRole('timer');
    await timersReady();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('alert').textContent).toMatch(/El tiempo para pagar ha terminado/);
    expect(screen.getByRole('link', { name: 'Volver a mi reserva' }).getAttribute('href')).toBe('/reserva');
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('una reserva confirmada mostra el número de reserva i no té compte enrere', async () => {
    renderHold(makeBooking({ status: 'confirmed', holdExpiresAt: null }));

    expect((await screen.findByRole('status')).textContent).toMatch(/Número de reserva: B4-2030-000007/);
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('«Cancelar y volver a mi reserva» allibera la reserva i torna a la cistella', async () => {
    cancelBooking.mockResolvedValue(null);
    renderHold(makeBooking());

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar y volver a mi reserva' }));
    expect(await screen.findByText('Cistella')).toBeTruthy();
    expect(cancelBooking).toHaveBeenCalledWith('b1');
  });

  it('si no es pot cancel·lar, es mostra el motiu i es pot tornar a provar', async () => {
    cancelBooking.mockRejectedValueOnce(new Error('Esta reserva ya no se puede cancelar'));
    renderHold(makeBooking());
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar y volver a mi reserva' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya no se puede cancelar/);
    expect(screen.getByRole('button', { name: 'Cancelar y volver a mi reserva' }).disabled).toBe(false);
  });
});
