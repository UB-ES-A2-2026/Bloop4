import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProofPage from './ProofPage';
import SellerServicesPage from './SellerServicesPage';
import { fetchProof, fetchSellerServices } from '../api/proofApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/proofApi', () => ({ fetchProof: vi.fn(), fetchSellerServices: vi.fn() }));

const proof = (overrides = {}) => ({
  serviceId: 's1', type: 'pickup', status: 'delivered', seller: { legalName: 'Sonido Levante S.L.' }, completedAt: '2030-06-16T10:30:00.000Z',
  items: [
    { eventItemId: 'i1', name: 'Altavoz activo', quantity: 3, condition: 'correct', note: null, photos: [{ id: 'p1', url: '/api/proofs/photos/p1' }] },
    { eventItemId: 'i2', name: 'Mesa de mezclas', quantity: 1, condition: 'damaged', note: 'Fader roto', photos: [] },
  ],
  incidents: [{ id: 'x1', kind: 'damaged', description: 'Mesa de mezclas: Fader roto', status: 'open', photoUrl: null }],
  ...overrides,
});

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/pruebas/:id" element={<ProofPage />} />
        <Route path="/vendedor/servicios" element={<SellerServicesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchProof.mockReset();
  fetchSellerServices.mockReset();
});

describe('ProofPage', () => {
  it('mostra l\'estat i les fotos de cada línia i les incidències pendents', async () => {
    fetchProof.mockResolvedValue(proof());
    renderAt('/pruebas/s1');
    expect(await screen.findByRole('heading', { name: 'Prueba de la recogida · Sonido Levante S.L.' })).toBeTruthy();
    const [ok, damaged] = screen.getAllByRole('listitem').filter((li) => li.className === 'proof-view__line');
    expect(within(ok).getByText('Correcto')).toBeTruthy();
    expect(within(ok).getByAltText('Foto de Altavoz activo').getAttribute('src')).toBe('/api/proofs/photos/p1');
    expect(within(damaged).getByText('Dañado')).toBeTruthy();
    expect(within(damaged).getByText('Fader roto')).toBeTruthy();
    expect(screen.getByText(/Pendiente de revisión/)).toBeTruthy();
  });

  it('una prova que no es pot veure respon que no existeix', async () => {
    fetchProof.mockImplementation(async () => {
      throw new ApiRequestError('Servicio no encontrado', { status: 404 });
    });
    renderAt('/pruebas/s9');
    expect(await screen.findByText('Prueba no encontrada')).toBeTruthy();
  });
});

describe('SellerServicesPage', () => {
  it('llista els serveis del venedor amb l\'enllaç a la prova i les incidències obertes', async () => {
    fetchSellerServices.mockResolvedValue([
      { id: 's1', type: 'pickup', status: 'delivered', timeWindow: { startsAt: '2030-06-16T10:00:00Z' }, bookingNumber: 'B4-2030-000001', hasProof: true, openIncidents: 1 },
      { id: 's2', type: 'delivery', status: 'pending', timeWindow: { startsAt: '2030-06-14T06:00:00Z' }, bookingNumber: 'B4-2030-000001', hasProof: false, openIncidents: 0 },
    ]);
    renderAt('/vendedor/servicios');
    const rows = await screen.findAllByRole('row');
    expect(within(rows[1]).getByRole('link', { name: 'Ver prueba' }).getAttribute('href')).toBe('/pruebas/s1');
    expect(within(rows[1]).getByText(/Incidencia abierta/)).toBeTruthy();
    expect(within(rows[2]).getByText('Sin repartidor')).toBeTruthy();
    expect(within(rows[2]).queryByRole('link')).toBeNull();
  });
});
