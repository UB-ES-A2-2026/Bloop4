import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RiderServicePage from './RiderServicePage';
import { fetchMyService } from '../api/riderApi';
import { ApiRequestError } from '../api/http';
import { makeAssignedService } from '../test/fixtures';

// Tot el client del rider es simula: les zones de les històries també en fan servir parts.
vi.mock('../api/riderApi', () => ({
  fetchAvailableServices: vi.fn(async () => []),
  acceptService: vi.fn(),
  fetchMyServices: vi.fn(async () => []),
  fetchMyService: vi.fn(),
  startService: vi.fn(),
  uploadProofPhoto: vi.fn(),
  fetchProofPhotos: vi.fn(async () => []),
  deleteProofPhoto: vi.fn(),
  completeService: vi.fn(),
  reportIncident: vi.fn(),
  sendLocation: vi.fn(),
}));

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/repartidor/servicios/:id" element={<RiderServicePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => fetchMyService.mockReset());

describe('RiderServicePage (fonaments)', () => {
  it('mostra l\'adreça, el client, les instruccions, el material i l\'enllaç al mapa', async () => {
    fetchMyService.mockResolvedValue(makeAssignedService());
    renderAt('/repartidor/servicios/s1');

    expect(await screen.findByText('Laura Cliente')).toBeTruthy();
    expect(screen.getByText(/Portón verde/)).toBeTruthy();
    expect(screen.getByText('Altavoz activo').nextSibling.textContent).toBe('3 ud.');
    const map = screen.getByRole('link', { name: 'Abrir en el mapa' });
    expect(map.getAttribute('href')).toBe('https://www.google.com/maps/search/?api=1&query=Calle%20Ficticia%201%2C%2046001%20Valencia');
    expect(map.getAttribute('rel')).toMatch(/noopener/);
  });

  it('un servei cancel·lat ho diu clarament; un d\'un altre rider respon que no existeix', async () => {
    fetchMyService.mockResolvedValueOnce(makeAssignedService({ status: 'cancelled' }));
    const { unmount } = renderAt('/repartidor/servicios/s1');
    expect((await screen.findByRole('alert')).textContent).toMatch(/se ha cancelado/);
    unmount();

    fetchMyService.mockImplementationOnce(async () => {
      throw new ApiRequestError('Servicio no encontrado', { status: 404 });
    });
    renderAt('/repartidor/servicios/s9');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Servicio no encontrado' })).toBeTruthy());
  });
});
