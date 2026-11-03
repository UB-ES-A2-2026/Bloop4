import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AvailabilityPicker from './AvailabilityPicker';
import { ApiRequestError, fetchAvailability, fetchAvailabilityCalendar } from '../api/catalogApi';
import { toInputValue } from '../lib/dates';

vi.mock('../api/catalogApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAvailability: vi.fn(),
  fetchAvailabilityCalendar: vi.fn(),
}));

const PRODUCT = { id: 'p1' };
const inDays = (days, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const choose = (from, to) => {
  fireEvent.change(screen.getByLabelText('Inicio del evento'), { target: { value: toInputValue(from) } });
  fireEvent.change(screen.getByLabelText('Fin del evento'), { target: { value: toInputValue(to) } });
};
const AVAILABLE = { availableUnits: 3, totalUnits: 4, billableDays: 2, totalPrice: '90.00', currency: 'EUR', suggestions: [] };

beforeEach(() => {
  fetchAvailability.mockReset();
  fetchAvailabilityCalendar.mockReset().mockResolvedValue([]);
});

describe('AvailabilityPicker', () => {
  it('amb un interval vàlid mostra les unitats lliures i el preu total', async () => {
    fetchAvailability.mockResolvedValue(AVAILABLE);
    const onChange = vi.fn();
    render(<AvailabilityPicker product={PRODUCT} onChange={onChange} />);
    const from = inDays(10, 10);
    const to = inDays(11, 12);
    choose(from, to);

    expect(await screen.findByText('Disponible (3 unidades)')).toBeTruthy();
    expect(screen.getByText(/Total: 90\s€ \(2 días\)/)).toBeTruthy();
    expect(fetchAvailability.mock.lastCall[1]).toEqual({ from, to });
    expect(onChange).toHaveBeenLastCalledWith({ from, to });
  });

  it('no consulta l\'API si la fi és anterior a l\'inici o si és al passat', () => {
    render(<AvailabilityPicker product={PRODUCT} />);
    choose(inDays(10, 12), inDays(10, 10));
    expect(screen.getByRole('alert').textContent).toBe('La fecha de fin debe ser posterior a la de inicio.');
    choose(inDays(-2, 10), inDays(1, 10));
    expect(screen.getByRole('alert').textContent).toBe('No se pueden elegir fechas pasadas.');
    expect(fetchAvailability).not.toHaveBeenCalled();
  });

  it('sense disponibilitat proposa dates properes i es poden aplicar', async () => {
    const suggestion = { from: inDays(12, 10).toISOString(), to: inDays(13, 12).toISOString(), availableUnits: 2 };
    fetchAvailability.mockResolvedValueOnce({ ...AVAILABLE, availableUnits: 0, suggestions: [suggestion] }).mockResolvedValue(AVAILABLE);
    render(<AvailabilityPicker product={PRODUCT} />);
    choose(inDays(10, 10), inDays(11, 12));

    expect(await screen.findByText('No disponible en esas fechas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /\(2\)$/ }));
    await waitFor(() => expect(fetchAvailability.mock.lastCall[1].from.toISOString()).toBe(suggestion.from));
    expect(await screen.findByText('Disponible (3 unidades)')).toBeTruthy();
  });

  it('si la consulta falla mostra l\'error amb "Reintentar"', async () => {
    fetchAvailability.mockRejectedValueOnce(new ApiRequestError('No se pudo conectar con el servidor')).mockResolvedValue(AVAILABLE);
    render(<AvailabilityPicker product={PRODUCT} />);
    choose(inDays(10, 10), inDays(11, 12));

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Disponible (3 unidades)')).toBeTruthy();
  });

  it('el calendari marca els dies sense unitats lliures', async () => {
    const month = toInputValue(new Date()).slice(0, 7);
    fetchAvailabilityCalendar.mockResolvedValue([`${month}-15`]);
    render(<AvailabilityPicker product={PRODUCT} />);
    expect(await screen.findByLabelText('15: sin unidades libres')).toBeTruthy();
    expect(fetchAvailabilityCalendar.mock.calls[0][1]).toBe(month);
  });
});
