import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../auth/AuthContext';
import { fetchMe, login } from '../api/authApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/authApi', () => ({ fetchMe: vi.fn(), login: vi.fn(), logout: vi.fn() }));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/iniciar-sesion']}>
      <AuthProvider>
        <Routes>
          <Route path="/iniciar-sesion" element={<LoginPage />} />
          <Route path="/" element={<p>Catálogo</p>} />
          <Route path="/vendedor" element={<p>Panel del vendedor</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function fill(email, password) {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(() => {
  fetchMe.mockReset().mockResolvedValue(null);
  login.mockReset();
});

describe('LoginPage', () => {
  it('un client va al catàleg i un venedor al seu panell', async () => {
    login.mockResolvedValueOnce({ roles: ['customer'] });
    const { unmount } = renderLogin();
    fill('laura@example.com', 'contrasenya1');
    expect(await screen.findByText('Catálogo')).toBeTruthy();
    expect(login).toHaveBeenCalledWith({ email: 'laura@example.com', password: 'contrasenya1' });
    unmount();

    login.mockResolvedValueOnce({ roles: ['seller'] });
    renderLogin();
    fill('sonido@example.com', 'contrasenya1');
    expect(await screen.findByText('Panel del vendedor')).toBeTruthy();
  });

  it('mostra el missatge genèric de l\'API si les credencials no són correctes', async () => {
    login.mockRejectedValue(new ApiRequestError('Correo o contraseña incorrectos', { status: 401 }));
    renderLogin();
    fill('laura@example.com', 'malament');
    expect((await screen.findByRole('alert')).textContent).toBe('Correo o contraseña incorrectos');
  });
});
