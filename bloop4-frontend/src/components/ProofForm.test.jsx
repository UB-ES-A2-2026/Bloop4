import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProofForm from './ProofForm';
import IncidentForm from './IncidentForm';
import { completeService, deleteProofPhoto, fetchProofPhotos, reportIncident, uploadProofPhoto } from '../api/riderApi';
import { ApiRequestError } from '../api/http';
import { makeAssignedService } from '../test/fixtures';

vi.mock('../api/riderApi', () => ({
  fetchProofPhotos: vi.fn(),
  uploadProofPhoto: vi.fn(),
  deleteProofPhoto: vi.fn(),
  completeService: vi.fn(),
  reportIncident: vi.fn(),
}));

const service = makeAssignedService({
  status: 'in_transit',
  items: [
    { eventItemId: 'i1', name: 'Altavoz activo', quantity: 3 },
    { eventItemId: 'i2', name: 'Mesa de mezclas', quantity: 1 },
  ],
});
const jpeg = (name = 'foto.jpg') => new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' });
const choose = (line, files) => fireEvent.change(within(line).getByLabelText('Añadir foto'), { target: { files } });
const lines = () => screen.getAllByRole('group');

beforeEach(() => {
  for (const fn of [fetchProofPhotos, uploadProofPhoto, deleteProofPhoto, completeService, reportIncident]) fn.mockReset();
  fetchProofPhotos.mockResolvedValue([]);
});

describe('ProofForm', () => {
  it('no deixa completar sense una foto i l\'estat de cada línia', async () => {
    render(<ProofForm service={service} onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Completar entrega' }));
    expect(within(lines()[0]).getByText('Falta al menos una foto. Indica el estado.')).toBeTruthy();
    expect(completeService).not.toHaveBeenCalled();
  });

  it('amb fotos i estats complets, envia el checklist; el material danyat demana explicació', async () => {
    uploadProofPhoto.mockImplementation(async (id, file, itemId) => ({ id: `p-${itemId}`, eventItemId: itemId, url: `/api/proofs/photos/p-${itemId}` }));
    completeService.mockResolvedValue({ ...service, status: 'delivered' });
    const onCompleted = vi.fn();
    render(<ProofForm service={service} onCompleted={onCompleted} />);

    choose(lines()[0], [jpeg()]);
    choose(lines()[1], [jpeg()]);
    expect(await screen.findByAltText('Foto de Altavoz activo')).toBeTruthy();
    await screen.findByAltText('Foto de Mesa de mezclas');
    fireEvent.click(within(lines()[0]).getByLabelText('Correcto'));
    fireEvent.click(within(lines()[1]).getByLabelText('Dañado'));
    fireEvent.click(screen.getByRole('button', { name: 'Completar entrega' }));
    expect(within(lines()[1]).getByText('Explica qué le pasa al material.')).toBeTruthy();

    fireEvent.change(within(lines()[1]).getByLabelText('¿Qué le pasa?'), { target: { value: 'Fader roto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Completar entrega' }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalled());
    expect(completeService).toHaveBeenCalledWith(service.id, [
      { eventItemId: 'i1', condition: 'correct', note: undefined },
      { eventItemId: 'i2', condition: 'damaged', note: 'Fader roto' },
    ]);
    expect(uploadProofPhoto).toHaveBeenCalledWith(service.id, expect.any(File), 'i1');
  });

  it('si una foto falla es pot reintentar només aquella; un fitxer no admès es rebutja', async () => {
    uploadProofPhoto.mockImplementationOnce(async () => {
      throw new ApiRequestError('No se pudo conectar con el servidor');
    }).mockResolvedValueOnce({ id: 'p1', eventItemId: 'i1', url: '/api/proofs/photos/p1' });
    render(<ProofForm service={service} onCompleted={vi.fn()} />);

    choose(lines()[0], [jpeg()]);
    fireEvent.click(await within(lines()[0]).findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByAltText('Foto de Altavoz activo')).toBeTruthy();
    expect(uploadProofPhoto).toHaveBeenCalledTimes(2);

    choose(lines()[1], [new File(['x'], 'doc.pdf', { type: 'application/pdf' })]);
    expect(within(lines()[1]).getByRole('alert').textContent).toMatch(/no es una foto/);
  });

  it('si l\'API rebutja el registre, ho mostra i no es perd el que s\'ha omplert', async () => {
    fetchProofPhotos.mockResolvedValue([
      { id: 'p1', eventItemId: 'i1', url: '/x' },
      { id: 'p2', eventItemId: 'i2', url: '/y' },
    ]);
    completeService.mockImplementation(async () => {
      throw new ApiRequestError('No se pudo conectar con el servidor');
    });
    render(<ProofForm service={service} onCompleted={vi.fn()} />);
    await screen.findAllByAltText(/Foto de/);
    fireEvent.click(within(lines()[0]).getByLabelText('Correcto'));
    fireEvent.click(within(lines()[1]).getByLabelText('Correcto'));
    fireEvent.click(screen.getByRole('button', { name: 'Completar entrega' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo conectar con el servidor');
    expect(within(lines()[0]).getByLabelText('Correcto').checked).toBe(true);
  });
});

describe('IncidentForm', () => {
  it('registra la incidència amb el motiu, l\'explicació i la foto', async () => {
    uploadProofPhoto.mockResolvedValue({ id: 'p9' });
    reportIncident.mockResolvedValue({ id: 'i1' });
    const onReported = vi.fn();
    render(<IncidentForm service={service} onReported={onReported} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar incidencia' }));
    expect(screen.getByRole('alert').textContent).toBe('Explica qué ha pasado.');
    fireEvent.change(screen.getByLabelText('Qué ha pasado'), { target: { value: 'Nadie abre la puerta' } });
    fireEvent.change(screen.getByLabelText('Foto (opcional)'), { target: { files: [jpeg()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar incidencia' }));
    await waitFor(() => expect(onReported).toHaveBeenCalled());
    expect(uploadProofPhoto).toHaveBeenCalledWith(service.id, expect.any(File), null);
    expect(reportIncident).toHaveBeenCalledWith(service.id, { kind: 'customer_absent', description: 'Nadie abre la puerta', photoId: 'p9' });
  });
});
