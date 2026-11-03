import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BecomeSellerPage from './BecomeSellerPage';
import { useAuth } from '../auth/AuthContext';
import { ApiRequestError } from '../api/http';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const CLIENT = { roles: ['customer'], status: 'active' };
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/hazte-vendedor']}>
      <Routes>
        <Route path="/hazte-vendedor" element={<BecomeSellerPage />} />
        <Route path="/vendedor" element={<p>Panel del vendedor</p>} />
      </Routes>
    </MemoryRouter>,
  );
const fill = () => {
  fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Luces S.L.' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Valencia' } });
  fireEvent.click(screen.getByRole('button', { name: 'Añadir mi empresa' }));
};

describe('BecomeSellerPage', () => {
  it('un client afegeix la seva empresa i va al panell del venedor', async () => {
    const becomeSeller = vi.fn().mockResolvedValue({ roles: ['customer', 'seller'] });
    useAuth.mockReturnValue({ user: CLIENT, becomeSeller });
    renderPage();
    fill();
    expect(await screen.findByText('Panel del vendedor')).toBeTruthy();
    expect(becomeSeller).toHaveBeenCalledWith({ legalName: 'Luces S.L.', city: 'Valencia' });
  });

  it('sense raó social no s\'envia; un error de l\'API es mostra', async () => {
    const becomeSeller = vi.fn().mockRejectedValue(new ApiRequestError('Tu cuenta ya es de empresa arrendadora', { status: 409 }));
    useAuth.mockReturnValue({ user: CLIENT, becomeSeller });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir mi empresa' }));
    expect(screen.getByRole('alert').textContent).toMatch(/razón social/);
    fill();
    expect((await screen.findByRole('alert')).textContent).toBe('Tu cuenta ya es de empresa arrendadora');
  });

  it('un compte sense verificar no pot enviar el formulari', () => {
    useAuth.mockReturnValue({ user: { ...CLIENT, status: 'pending_verification' }, becomeSeller: vi.fn() });
    renderPage();
    expect(screen.getByRole('button', { name: 'Añadir mi empresa' }).disabled).toBe(true);
  });

  it('si ja és venedor, enllaça al panell', () => {
    useAuth.mockReturnValue({ user: { roles: ['customer', 'seller'], status: 'active' }, becomeSeller: vi.fn() });
    renderPage();
    expect(screen.getByRole('link', { name: 'Ir a mi panel' })).toBeTruthy();
  });
});
