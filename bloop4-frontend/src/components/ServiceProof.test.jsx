import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceProof from './ServiceProof';
import { fetchProofPhotos } from '../api/riderApi';
import { makeAssignedService } from '../test/fixtures';

vi.mock('../api/riderApi', () => ({
  fetchProofPhotos: vi.fn(),
  uploadProofPhoto: vi.fn(),
  deleteProofPhoto: vi.fn(),
  completeService: vi.fn(),
  reportIncident: vi.fn(),
}));

const renderProof = (service, props = {}) =>
  render(
    <MemoryRouter>
      <ServiceProof service={service} onCompleted={vi.fn()} reload={vi.fn()} {...props} />
    </MemoryRouter>,
  );

beforeEach(() => fetchProofPhotos.mockReset().mockResolvedValue([]));

describe('ServiceProof (US-11)', () => {
  it('amb el servei en curs, el rider completa la prova o registra una incidència', async () => {
    renderProof(makeAssignedService({ status: 'in_transit' }));
    expect(await screen.findByRole('heading', { name: 'Completar la entrega' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'No puedo completar el servicio: registrar una incidencia' }));
    expect(screen.getByRole('heading', { name: 'Registrar una incidencia' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Completar la entrega' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(await screen.findByRole('heading', { name: 'Completar la entrega' })).toBeTruthy();
  });

  it('un servei completat o amb incidència enllaça la prova; un d\'assignat encara no en té', () => {
    const { unmount } = renderProof(makeAssignedService({ status: 'delivered' }));
    expect(screen.getByRole('link', { name: 'Ver la prueba' }).getAttribute('href')).toBe('/pruebas/s1');
    unmount();

    const incident = renderProof(makeAssignedService({ status: 'incident' }));
    expect(screen.getByRole('link', { name: 'Ver detalle' }).getAttribute('href')).toBe('/pruebas/s1');
    incident.unmount();

    const { container } = renderProof(makeAssignedService());
    expect(container.textContent).toBe('');
  });
});
