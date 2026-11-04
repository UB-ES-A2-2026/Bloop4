import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DeliveryForm from './DeliveryForm';
import { fetchDeliverySlots, saveDelivery } from '../api/cartApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/cartApi', () => ({ fetchDeliverySlots: vi.fn(), saveDelivery: vi.fn() }));

// Esdeveniment del 04/07/2030 de 10:00 a 05/07/2030 11:00 (hora de Madrid, +02:00).
const CART = { startsAt: '2030-07-04T08:00:00.000Z', endsAt: '2030-07-05T09:00:00.000Z', delivery: null };
const slot = (date, hour, available = true) => {
  const startsAt = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+02:00`);
  return { startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 7_200_000).toISOString(), available };
};
const day = (date, full = []) => [8, 10, 12, 14, 16, 18, 20].map((h) => slot(date, h, !full.includes(h)));

beforeEach(() => {
  fetchDeliverySlots.mockReset().mockImplementation(async (cp, date) => (date === '2030-07-04' ? day(date, [8]) : day(date)));
  saveDelivery.mockReset().mockResolvedValue({});
});

const fillAddress = () => {
  fireEvent.change(screen.getByLabelText('Dirección del evento'), { target: { value: 'Calle Ficticia 2' } });
  fireEvent.change(screen.getByLabelText('Código postal'), { target: { value: '46001' } });
};

describe('DeliveryForm', () => {
  it('amb el codi postal carrega les franges dels dies de l\'esdeveniment', async () => {
    render(<DeliveryForm cart={CART} onSaved={() => {}} />);
    fillAddress();
    await screen.findByRole('radiogroup', { name: 'Entrega' });
    expect(fetchDeliverySlots).toHaveBeenCalledWith('46001', '2030-07-04', expect.anything());
    expect(fetchDeliverySlots).toHaveBeenCalledWith('46001', '2030-07-05', expect.anything());
  });

  it('desactiva les franges plenes i les que no encaixen amb l\'esdeveniment', async () => {
    render(<DeliveryForm cart={CART} onSaved={() => {}} />);
    fillAddress();
    const delivery = await screen.findByRole('radiogroup', { name: 'Entrega' });
    const pickup = await screen.findByRole('radiogroup', { name: 'Recogida' });
    // Entrega el dia 4: la de 08:00 és plena i a partir de les 10:00 ja ha començat l'esdeveniment.
    expect(within(delivery).getAllByRole('radio').filter((b) => !b.disabled)).toHaveLength(0);
    // Recogida el dia 5: només a partir de les 12:00 (l'esdeveniment acaba a les 11:00).
    expect(within(pickup).getAllByRole('radio').filter((b) => !b.disabled).map((b) => b.textContent.slice(0, 5))).toEqual([
      '12:00', '14:00', '16:00', '18:00', '20:00',
    ]);
  });

  it('desa l\'adreça i les franges triades', async () => {
    const onSaved = vi.fn();
    render(<DeliveryForm cart={CART} onSaved={onSaved} />);
    fillAddress();
    fireEvent.change(screen.getByLabelText('Día de entrega'), { target: { value: '2030-07-03' } });
    fireEvent.click(await within(await screen.findByRole('radiogroup', { name: 'Entrega' })).findByRole('radio', { name: /^18:00/ }));
    fireEvent.click(within(await screen.findByRole('radiogroup', { name: 'Recogida' })).getByRole('radio', { name: /^12:00/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrega' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveDelivery).toHaveBeenCalledWith({
      street: 'Calle Ficticia 2', postalCode: '46001', city: 'Valencia', accessInstructions: '',
      deliveryStartsAt: slot('2030-07-03', 18).startsAt, pickupStartsAt: slot('2030-07-05', 12).startsAt,
    });
  });

  it('fora de cobertura mostra el missatge i els venedors', async () => {
    fetchDeliverySlots.mockRejectedValue(
      new ApiRequestError('Esta dirección está fuera de la zona de reparto', { status: 400, code: 'OUT_OF_COVERAGE', details: { sellers: ['Sonido Levante S.L.'] } }),
    );
    render(<DeliveryForm cart={CART} onSaved={() => {}} />);
    fillAddress();
    expect((await screen.findAllByRole('alert'))[0].textContent).toBe('Esta dirección está fuera de la zona de reparto (Sonido Levante S.L.)');
  });

  it('sense franges triades no s\'envia', () => {
    render(<DeliveryForm cart={CART} onSaved={() => {}} />);
    fillAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar entrega' }));
    expect(screen.getByRole('alert').textContent).toBe('Elige una franja de entrega y una de recogida.');
    expect(saveDelivery).not.toHaveBeenCalled();
  });
});
