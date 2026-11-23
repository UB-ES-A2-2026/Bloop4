import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MyServicesPage from './MyServicesPage';
import { fetchMyServices } from '../api/riderApi';
import { ApiRequestError } from '../api/http';
import { makeAssignedService } from '../test/fixtures';

vi.mock('../api/riderApi', () => ({ fetchMyServices: vi.fn() }));

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/repartidor" element={<MyServicesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => fetchMyServices.mockReset());

describe('US-15 · MyServicesPage', () => {
  it('mostra els serveis del dia amb l\'estat, l\'adreça i l\'enllaç al detall', async () => {
    fetchMyServices.mockResolvedValue([
      makeAssignedService(),
      makeAssignedService({ id: 's2', type: 'pickup', status: 'in_transit', changedSinceAssigned: true }),
      makeAssignedService({ id: 's3', status: 'cancelled', changedSinceAssigned: true }),
    ]);
    renderAt('/repartidor?dia=2030-06-15');

    const items = await screen.findAllByRole('listitem');
    expect(fetchMyServices).toHaveBeenCalledWith('2030-06-15', expect.anything());
    expect(within(items[0]).getByText('Pendiente')).toBeTruthy();
    expect(within(items[0]).getByText('Calle Ficticia 1, 46001 Valencia')).toBeTruthy();
    expect(within(items[0]).getByRole('link', { name: 'Ver detalle' }).getAttribute('href')).toBe('/repartidor/servicios/s1');
    expect(within(items[1]).getByText('En curso')).toBeTruthy();
    expect(within(items[1]).getByText('Modificado')).toBeTruthy();
    expect(within(items[2]).getByText('Cancelado')).toBeTruthy();
    expect(within(items[2]).queryByText('Modificado')).toBeNull();
  });

  it('canviar el dia torna a demanar la llista; un dia sense serveis mostra un missatge', async () => {
    fetchMyServices.mockResolvedValueOnce([makeAssignedService()]).mockResolvedValueOnce([]);
    renderAt('/repartidor?dia=2030-06-15');
    await screen.findAllByRole('listitem');

    fireEvent.change(screen.getByLabelText('Día'), { target: { value: '2030-06-18' } });
    expect(await screen.findByText('No tienes servicios este día')).toBeTruthy();
    expect(fetchMyServices).toHaveBeenLastCalledWith('2030-06-18', expect.anything());
  });

  it('en sortir de la pàgina o canviar de dia, avorta la petició anterior', async () => {
    const signals = [];
    fetchMyServices.mockImplementation((date, { signal }) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    const { unmount } = renderAt('/repartidor?dia=2030-06-15');
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: '2030-06-18' } });
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    unmount();
    expect(signals[1].aborted).toBe(true);
  });

  it('sense dia a la URL demana els d\'avui; un error es pot reintentar', async () => {
    fetchMyServices.mockImplementationOnce(async () => {
      throw new ApiRequestError('No se pudo conectar con el servidor');
    }).mockResolvedValueOnce([]);
    renderAt('/repartidor');
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No tienes servicios este día')).toBeTruthy();
    expect(fetchMyServices.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
