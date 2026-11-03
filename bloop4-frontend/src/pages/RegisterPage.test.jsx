import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import { register } from '../api/authApi';

vi.mock('../api/authApi', () => ({ register: vi.fn() }));

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillCustomer() {
  type('Nombre y apellidos', 'Laura Cliente');
  type('Correo electrónico', 'laura@example.com');
  type('Contraseña (mínimo 8 caracteres)', 'contrasenya1');
}

beforeEach(() => register.mockReset().mockResolvedValue('Revisa tu correo para activar la cuenta.'));

describe('RegisterPage', () => {
  it('sense acceptar els termes no envia res', () => {
    render(<RegisterPage />, { wrapper: MemoryRouter });
    fillCustomer();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByRole('alert').textContent).toMatch(/aceptar los términos/);
    expect(register).not.toHaveBeenCalled();
  });

  it('rebutja contrasenyes de menys de 8 caràcters', () => {
    render(<RegisterPage />, { wrapper: MemoryRouter });
    fillCustomer();
    type('Contraseña (mínimo 8 caracteres)', '1234567');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByRole('alert').textContent).toMatch(/al menos 8/);
  });

  it('un client s\'envia sense dades d\'empresa i es mostra el missatge de l\'API', async () => {
    render(<RegisterPage />, { wrapper: MemoryRouter });
    fillCustomer();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Revisa tu correo para activar la cuenta.')).toBeTruthy();
    expect(register).toHaveBeenCalledWith({
      role: 'customer',
      fullName: 'Laura Cliente',
      email: 'laura@example.com',
      password: 'contrasenya1',
      acceptTerms: true,
    });
  });

  it('un venedor ha d\'omplir la raó social i la ciutat', async () => {
    render(<RegisterPage />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole('radio', { name: /Publicar el material/ }));
    fillCustomer();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByRole('alert').textContent).toMatch(/razón social/);

    type('Razón social', 'Luces S.L.');
    type('Ciudad', 'Valencia');
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await screen.findByText('Revisa tu correo para activar la cuenta.');
    expect(register.mock.calls[0][0]).toMatchObject({ role: 'seller', legalName: 'Luces S.L.', city: 'Valencia' });
  });
});
