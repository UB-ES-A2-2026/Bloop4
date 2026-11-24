import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AvailableServicesPage from './AvailableServicesPage';
import { acceptService, fetchAvailableServices } from '../api/riderApi';
import { ApiRequestError } from '../api/http';
import { makeService } from '../test/fixtures';

vi.mock('../api/riderApi', () => ({ fetchAvailableServices: vi.fn(), acceptService: vi.fn() }));

const renderPage = () => render(<AvailableServicesPage />, { wrapper: MemoryRouter });

beforeEach(() => {
  fetchAvailableServices.mockReset();
  acceptService.mockReset();
});

describe('AvailableServicesPage', () => {
  it('mostra el tipus, la franja, la zona i el material de cada servei, sense dades del client', async () => {
    fetchAvailableServices.mockResolvedValue([makeService(), makeService({ id: 's2', type: 'pickup' })]);
    renderPage();

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Entrega')).toBeTruthy();
    expect(within(items[0]).getByText('46001 Valencia · Furgoneta')).toBeTruthy();
    expect(within(items[0]).getByText(/Sonido Levante S\.L\. · 3 × Altavoz activo/)).toBeTruthy();
    expect(within(items[1]).getByText('Recogida')).toBeTruthy();
    expect(screen.queryByText(/Calle/)).toBeNull();
  });

  it('acceptar un servei confirma l\'acceptació i torna a carregar la llista', async () => {
    fetchAvailableServices.mockResolvedValueOnce([makeService()]).mockResolvedValueOnce([]);
    acceptService.mockResolvedValue(makeService({ status: 'assigned', address: { street: 'Calle Ficticia 1', postalCode: '46001', city: 'Valencia' } }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Entrega aceptada: Calle Ficticia 1, 46001 Valencia/);
    expect(acceptService).toHaveBeenCalledWith('s1');
    expect(await screen.findByText('No hay servicios disponibles')).toBeTruthy();
  });

  it('si un altre rider s\'hi ha avançat, ho diu i el servei desapareix', async () => {
    fetchAvailableServices.mockResolvedValueOnce([makeService()]).mockResolvedValueOnce([]);
    acceptService.mockImplementation(async () => {
      throw new ApiRequestError('Este servicio ya no está disponible: otro repartidor lo ha aceptado', { status: 409 });
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/otro repartidor lo ha aceptado/);
    await waitFor(() => expect(fetchAvailableServices).toHaveBeenCalledTimes(2));
  });

  it('no deixa acceptar un servei massa gran per al vehicle o que se solapa', async () => {
    fetchAvailableServices.mockResolvedValue([
      makeService({ fitsVehicle: false }),
      makeService({ id: 's2', scheduleConflict: true }),
    ]);
    renderPage();

    const [big, busy] = await screen.findAllByRole('button', { name: 'Aceptar' });
    expect(big.disabled).toBe(true);
    expect(busy.disabled).toBe(true);
    expect(screen.getByText('Tu vehículo no tiene capacidad suficiente')).toBeTruthy();
    expect(screen.getByText('Ya tienes otro servicio a esa hora')).toBeTruthy();
  });

  it('sense serveis mostra un missatge; un error es pot reintentar', async () => {
    fetchAvailableServices.mockImplementationOnce(async () => {
      throw new ApiRequestError('No se pudo conectar con el servidor');
    }).mockResolvedValueOnce([]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay servicios disponibles')).toBeTruthy();
  });
});
