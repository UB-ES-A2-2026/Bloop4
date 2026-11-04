import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CartPage from './CartPage';
import { fetchCart, removeCartItem, updateCartItem } from '../api/cartApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/cartApi', () => ({ fetchCart: vi.fn(), setCartDates: vi.fn(), updateCartItem: vi.fn(), removeCartItem: vi.fn() }));

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
});
