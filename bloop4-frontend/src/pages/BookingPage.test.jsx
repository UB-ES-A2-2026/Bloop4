import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookingPage from './BookingPage';
import { fetchBooking } from '../api/bookingApi';
import { ApiRequestError } from '../api/http';
import { makeBooking } from '../test/fixtures';

// Tot el client de les reserves es simula: les zones de les històries també en fan servir parts.
vi.mock('../api/bookingApi', () => ({
  checkoutCart: vi.fn(),
  fetchBookings: vi.fn(async () => []),
  fetchBooking: vi.fn(),
  cancelBooking: vi.fn(),
  startPayment: vi.fn(),
  fetchPayment: vi.fn(async () => ({ status: 'none', deposit: null })),
  completeMockPayment: vi.fn(),
  fetchTracking: vi.fn(async () => ({ checkedAt: '2030-01-01T10:00:00Z', sellers: [] })),
  fetchLocations: vi.fn(async () => []),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reservas/b1']}>
      <Routes>
        <Route path="/reservas/:id" element={<BookingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => fetchBooking.mockReset());

describe('BookingPage (fonaments)', () => {
  it('mostra l\'estat i el número de la reserva, i el resum amb els imports', async () => {
    fetchBooking.mockResolvedValue(makeBooking());
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Pendiente de pago' })).toBeTruthy();
    expect(screen.getByText('Reserva B4-2030-000007')).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Mis reservas' }).getAttribute('href')).toBe('/reservas');
    expect(screen.getByText('2 × Altavoz activo')).toBeTruthy();
    expect(screen.getByText('Total a pagar').nextSibling.textContent).toMatch(/^205\s€$/);
    expect(screen.getByText('Fianza (se retiene, no se cobra)').nextSibling.textContent).toMatch(/^300\s€$/);
    expect(fetchBooking).toHaveBeenCalledWith('b1', expect.anything());
  });

  it('si la reserva ja no existeix (bloqueig caducat) envia a la cistella; un error es pot reintentar', async () => {
    fetchBooking.mockRejectedValueOnce(new ApiRequestError('Reserva no encontrada', { status: 404 }));
    const { unmount } = renderPage();
    expect(await screen.findByRole('heading', { name: 'Reserva no encontrada' })).toBeTruthy();
    unmount();

    fetchBooking.mockRejectedValueOnce(new ApiRequestError('No se pudo conectar con el servidor')).mockResolvedValueOnce(makeBooking());
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pendiente de pago' })).toBeTruthy());
  });
});
