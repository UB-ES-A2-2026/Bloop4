import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrackingTimeline from './TrackingTimeline';

const service = (type, status, extra = {}) => ({
  id: `${type}-1`, type, status, delayed: false,
  timeWindow: { startsAt: '2030-06-15T06:00:00.000Z', endsAt: '2030-06-15T08:00:00.000Z' },
  history: [{ status: 'pending', at: '2030-06-01T08:00:00.000Z' }, { status, at: '2030-06-15T06:30:00.000Z' }],
  ...extra,
});
const tracking = (sellers) => ({ checkedAt: '2030-06-15T06:31:00.000Z', sellers });
/** Amb router, perquè la línia de temps enllaça les proves. */
const inRouter = (ui) => <MemoryRouter>{ui}</MemoryRouter>;
const group = (name, phase, delivery, pickup) => ({ seller: { id: name, legalName: name }, phase, delivery, pickup });

describe('TrackingTimeline', () => {
  it('marca les fases fetes i l\'actual, amb l\'hora del canvi', () => {
    render(inRouter(<TrackingTimeline tracking={tracking([group('Sonido', 'delivery_in_transit', service('delivery', 'in_transit'), service('pickup', 'assigned'))])} />));
    const steps = within(screen.getByRole('region', { name: 'Seguimiento de Sonido' })).getAllByRole('listitem');
    expect(steps.map((s) => s.className.includes('--done'))).toEqual([true, true, false, false, false]);
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(steps[1].textContent).toMatch(/En camino/);
    expect(steps[1].textContent).toMatch(/15 jun 2030/);
  });

  it('cada empresa té el seu seguiment', () => {
    render(
      inRouter(
        <TrackingTimeline
          tracking={tracking([
            group('Sonido', 'picked_up', service('delivery', 'delivered'), service('pickup', 'delivered')),
            group('Mobiliario', 'confirmed', service('delivery', 'assigned'), service('pickup', 'pending')),
          ])}
        />,
      ),
    );
    const sonido = within(screen.getByRole('region', { name: 'Seguimiento de Sonido' })).getAllByRole('listitem');
    const mobiliario = within(screen.getByRole('region', { name: 'Seguimiento de Mobiliario' })).getAllByRole('listitem');
    expect(sonido.every((s) => s.className.includes('--done'))).toBe(true);
    expect(mobiliario.filter((s) => s.className.includes('--done'))).toHaveLength(1);
  });

  it('avisa d\'un retard i mostra les incidències diferenciades', () => {
    const { rerender } = render(
      inRouter(<TrackingTimeline tracking={tracking([group('Sonido', 'confirmed', service('delivery', 'assigned', { delayed: true }), null)])} />),
    );
    expect(screen.getByRole('alert').textContent).toMatch(/La entrega va con retraso/);

    rerender(inRouter(<TrackingTimeline tracking={tracking([group('Sonido', 'incident', service('delivery', 'delivered'), service('pickup', 'incident'))])} />));
    expect(screen.getByRole('alert').textContent).toMatch(/Incidencia en la recogida/);
  });

  it('si l\'última consulta ha fallat, avisa que pot no estar al dia', () => {
    render(inRouter(<TrackingTimeline tracking={tracking([])} stale />));
    expect(screen.getByRole('status').textContent).toMatch(/puede que la información no esté al día/);
  });
});
