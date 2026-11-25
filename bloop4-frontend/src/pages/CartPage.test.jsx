import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CartPage from './CartPage';
import { fetchCart, removeCartItem, updateCartItem } from '../api/cartApi';
import { ApiRequestError } from '../api/http';
import { checkoutCart } from '../api/bookingApi';

vi.mock('../api/cartApi', () => ({ fetchCart: vi.fn(), setCartDates: vi.fn(), updateCartItem: vi.fn(), removeCartItem: vi.fn() }));
vi.mock('../api/bookingApi', () => ({ checkoutCart: vi.fn() }));
vi.mock('../components/DeliveryForm', () => ({ default: () => null }));

const item = (overrides = {}) => ({
  id: 'i1', product: { id: 'p1', name: 'Altavoz activo', status: 'published' }, quantity: 2, dailyPrice: '45.00',
  currentDailyPrice: '45.00', depositAmount: '150.00', currency: 'EUR', insurance: null, rentalSubtotal: '90.00',
  depositSubtotal: '300.00', warnings: [], ...overrides,
});
const cart = (items = [item()], canCheckout = true) => ({
  id: 'e1', startsAt: '2030-07-04T08:00:00.000Z', endsAt: '2030-07-05T08:00:00.000Z', billableDays: 1, currency: 'EUR',
  sellers: [{ seller: { id: 's1', legalName: 'Sonido Levante S.L.', city: 'Valencia' }, items, rentalSubtotal: '90.00', depositSubtotal: '300.00' }],
  totals: { rental: '90.00', deposit: '300.00', toPay: '90.00' },
  canCheckout,
});

beforeEach(() => {
  fetchCart.mockReset();
  updateCartItem.mockReset();
  removeCartItem.mockReset();
  checkoutCart.mockReset();
});

describe('CartPage', () => {
  it('mostra les línies agrupades per venedor i els totals', async () => {
    fetchCart.mockResolvedValue(cart());
    render(<CartPage />, { wrapper: MemoryRouter });

    const group = await screen.findByRole('region', { name: 'Sonido Levante S.L.' });
    expect(within(group).getByText('Altavoz activo')).toBeTruthy();
    expect(within(group).getByText(/Sin seguro/)).toBeTruthy();
    expect(screen.getByText('Fianza (se retiene, no se cobra)').nextSibling.textContent).toMatch(/^300\s€$/);
    expect(screen.getByText('Productos revisados. Ahora elige la entrega y la recogida.')).toBeTruthy();
  });

  it('una línia amb el preu canviat s\'ha de revisar: «Aceptar el nuevo precio» la desa', async () => {
    fetchCart.mockResolvedValue(cart([item({ warnings: [{ code: 'PRICE_CHANGED', currentDailyPrice: '50.00' }] })], false));
    updateCartItem.mockResolvedValue(cart());
    render(<CartPage />, { wrapper: MemoryRouter });

    expect(await screen.findByText('Revisa las líneas marcadas antes de continuar.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar el nuevo precio' }));
    expect(await screen.findByText('Productos revisados. Ahora elige la entrega y la recogida.')).toBeTruthy();
    expect(updateCartItem).toHaveBeenCalledWith('i1', 2);
  });

  it('si no hi ha prou unitats proposa ajustar la quantitat', async () => {
    fetchCart.mockResolvedValue(cart([item({ warnings: [{ code: 'UNAVAILABLE', availableUnits: 1 }] })], false));
    updateCartItem.mockResolvedValue(cart());
    render(<CartPage />, { wrapper: MemoryRouter });

    fireEvent.click(await screen.findByRole('button', { name: 'Ajustar a 1' }));
    await waitFor(() => expect(updateCartItem).toHaveBeenCalledWith('i1', 1));
  });

  it('mostra el 409 de l\'API si es demana més del que hi ha', async () => {
    fetchCart.mockResolvedValue(cart());
    updateCartItem.mockRejectedValue(
      new ApiRequestError('Solo queda 1 unidad disponible en las fechas del evento', { status: 409, details: { availableUnits: 1 } }),
    );
    render(<CartPage />, { wrapper: MemoryRouter });

    const input = (await screen.findAllByLabelText('Cantidad'))[0];
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    expect((await screen.findByRole('alert')).textContent).toBe('Solo queda 1 unidad disponible en las fechas del evento.');
  });

  it('eliminar una línia torna a carregar la cistella', async () => {
    fetchCart.mockResolvedValueOnce(cart()).mockResolvedValueOnce({ ...cart([]), sellers: [] });
    removeCartItem.mockResolvedValue(null);
    render(<CartPage />, { wrapper: MemoryRouter });

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar Altavoz activo' }));
    expect(await screen.findByText('Tu reserva está vacía')).toBeTruthy();
  });

  describe('confirmar la reserva (US-12)', () => {
    const ready = () => ({
      ...cart(),
      readyForPayment: true,
      totals: { rental: '90.00', deposit: '300.00', transport: '25.00', toPay: '115.00' },
      delivery: {
        valid: true, transport: [], transportTotal: '25.00',
        deliveryWindow: { startsAt: '2030-07-04T06:00:00.000Z' }, pickupWindow: { startsAt: '2030-07-05T10:00:00.000Z' },
      },
    });
    const renderCart = () =>
      render(
        <MemoryRouter initialEntries={['/reserva']}>
          <Routes>
            <Route path="/reserva" element={<CartPage />} />
            <Route path="/reservas/:id" element={<p>Reserva creada</p>} />
          </Routes>
        </MemoryRouter>,
      );

    it('el botó no surt fins que s\'ha triat el lliurament', async () => {
      fetchCart.mockResolvedValue(cart());
      render(<CartPage />, { wrapper: MemoryRouter });
      await screen.findByText('Productos revisados. Ahora elige la entrega y la recogida.');
      expect(screen.queryByRole('button', { name: 'Confirmar reserva' })).toBeNull();
    });

    it('«Confirmar reserva» fa el checkout amb una clau d\'idempotència i obre la reserva', async () => {
      fetchCart.mockResolvedValue(ready());
      checkoutCart.mockResolvedValue({ id: 'b1' });
      renderCart();

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar reserva' }));
      expect(await screen.findByText('Reserva creada')).toBeTruthy();
      expect(checkoutCart).toHaveBeenCalledTimes(1);
      expect(checkoutCart.mock.calls[0][0]).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    });

    it('si un producte ja no està disponible mostra quin és i torna a llegir la cistella', async () => {
      fetchCart.mockResolvedValue(ready());
      checkoutCart.mockRejectedValue(
        new ApiRequestError('«Altavoz activo» ya no está disponible en las fechas del evento', { status: 409, details: { reason: 'UNAVAILABLE' } }),
      );
      renderCart();

      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar reserva' }));
      expect((await screen.findByRole('alert')).textContent).toBe('«Altavoz activo» ya no está disponible en las fechas del evento');
      await waitFor(() => expect(fetchCart).toHaveBeenCalledTimes(2));
    });

    it('avisa quan el bloqueig d\'una reserva anterior ha caducat', async () => {
      fetchCart.mockResolvedValue({ ...ready(), holdExpiredAt: '2030-01-01T10:15:00Z' });
      renderCart();
      expect(await screen.findByText(/El tiempo para pagar terminó y hemos liberado el material/)).toBeTruthy();
    });
  });
});
