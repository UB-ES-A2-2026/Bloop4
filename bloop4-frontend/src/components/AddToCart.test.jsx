import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddToCart from './AddToCart';
import { useAuth } from '../auth/AuthContext';
import { addCartItem, fetchCart, setCartDates } from '../api/cartApi';

vi.mock('../api/cartApi', () => ({ fetchCart: vi.fn(), setCartDates: vi.fn(), addCartItem: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const RANGE = { from: new Date('2030-07-04T08:00:00Z'), to: new Date('2030-07-05T08:00:00Z') };
const PRODUCT = { id: 'p1' };
const renderButton = (range = RANGE) => render(<AddToCart product={PRODUCT} range={range} />, { wrapper: MemoryRouter });

beforeEach(() => {
  useAuth.mockReturnValue({ user: { roles: ['customer'] } });
  fetchCart.mockReset();
  setCartDates.mockReset().mockResolvedValue({});
  addCartItem.mockReset().mockResolvedValue({});
});

describe('AddToCart', () => {
  it('sense sessió convida a iniciar-la', () => {
    useAuth.mockReturnValue({ user: null });
    renderButton();
    expect(screen.getByRole('link', { name: 'Inicia sesión' })).toBeTruthy();
  });

  it('sense dates triades el botó està desactivat', () => {
    renderButton(null);
    expect(screen.getByRole('button', { name: 'Añadir a la reserva' }).disabled).toBe(true);
  });

  it('amb la cistella buida en desa les dates i hi afegeix el producte', async () => {
    fetchCart.mockResolvedValue({ startsAt: null, endsAt: null });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la reserva' }));

    expect(await screen.findByText(/Añadido a tu reserva/)).toBeTruthy();
    expect(setCartDates).toHaveBeenCalledWith(RANGE);
    expect(addCartItem).toHaveBeenCalledWith('p1', 1);
  });

  it('si la cistella té unes altres dates demana confirmació abans de canviar-les', async () => {
    fetchCart.mockResolvedValue({ startsAt: '2030-08-01T08:00:00.000Z', endsAt: '2030-08-02T08:00:00.000Z' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la reserva' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar la reserva a las nuevas fechas y añadir' }));
    expect(await screen.findByText(/Añadido a tu reserva/)).toBeTruthy();
    expect(setCartDates).toHaveBeenCalledTimes(1);
  });

  it('amb les mateixes dates no les torna a desar', async () => {
    fetchCart.mockResolvedValue({ startsAt: '2030-07-04T08:00:00.000Z', endsAt: '2030-07-05T08:00:00.000Z' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir a la reserva' }));
    await screen.findByText(/Añadido a tu reserva/);
    expect(setCartDates).not.toHaveBeenCalled();
  });
});
