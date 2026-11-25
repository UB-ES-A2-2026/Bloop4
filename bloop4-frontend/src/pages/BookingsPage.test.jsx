import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingsPage from './BookingsPage';
import { fetchBookings } from '../api/bookingApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/bookingApi', () => ({ fetchBookings: vi.fn() }));

const renderPage = () => render(<MemoryRouter><BookingsPage /></MemoryRouter>);

beforeEach(() => fetchBookings.mockReset());

describe('BookingsPage (fonaments)', () => {
  it('llista les reserves amb l\'estat i l\'enllaç al detall', async () => {
    fetchBookings.mockResolvedValue([
      { id: 'b1', bookingNumber: 'B4-2030-000007', status: 'pending_payment', startsAt: '2030-07-04T08:00:00Z' },
      { id: 'b2', bookingNumber: 'B4-2030-000001', status: 'confirmed', startsAt: '2030-06-15T10:00:00Z' },
    ]);
    renderPage();
    const rows = (await screen.findAllByRole('row')).slice(1);
    expect(within(rows[0]).getByRole('link', { name: 'B4-2030-000007' }).getAttribute('href')).toBe('/reservas/b1');
    expect(within(rows[0]).getByText('Pendiente de pago')).toBeTruthy();
    expect(within(rows[1]).getByText('Confirmada')).toBeTruthy();
  });

  it('sense reserves ho diu; un error es pot reintentar', async () => {
    fetchBookings.mockRejectedValueOnce(new ApiRequestError('No se pudo conectar con el servidor')).mockResolvedValueOnce([]);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Todavía no tienes reservas')).toBeTruthy();
  });
});
