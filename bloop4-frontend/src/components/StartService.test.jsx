import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StartService from './StartService';
import { startService } from '../api/riderApi';
import { ApiRequestError } from '../api/http';
import { makeAssignedService } from '../test/fixtures';

vi.mock('../api/riderApi', () => ({ startService: vi.fn() }));

beforeEach(() => startService.mockReset());

describe('StartService (US-09)', () => {
  it('«Iniciar entrega» inicia el servei i en passa el servei actualitzat', async () => {
    const onStarted = vi.fn();
    startService.mockResolvedValueOnce(makeAssignedService({ status: 'in_transit' }));
    render(<StartService service={makeAssignedService()} onStarted={onStarted} />);

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar entrega' }));
    await vi.waitFor(() => expect(onStarted).toHaveBeenCalledWith(expect.objectContaining({ status: 'in_transit' })));
    expect(startService).toHaveBeenCalledWith('s1');
    expect(screen.getByText('El cliente verá que vas de camino.')).toBeTruthy();
  });

  it('una recollida no es pot iniciar abans del lliurament: es mostra el motiu', async () => {
    startService.mockImplementationOnce(async () => {
      throw new ApiRequestError('La recogida no puede empezar antes de que se complete la entrega', { status: 409 });
    });
    render(<StartService service={makeAssignedService({ type: 'pickup' })} onStarted={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar recogida' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/antes de que se complete la entrega/);
  });

  it('un servei que no està assignat no es pot iniciar', () => {
    const { container } = render(<StartService service={makeAssignedService({ status: 'in_transit' })} onStarted={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});
