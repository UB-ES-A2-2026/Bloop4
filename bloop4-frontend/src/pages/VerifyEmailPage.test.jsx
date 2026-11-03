import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from './VerifyEmailPage';
import { resendVerification, verifyEmail } from '../api/authApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/authApi', () => ({ verifyEmail: vi.fn(), resendVerification: vi.fn(), fetchMe: vi.fn() }));

const renderAt = (url) =>
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[url]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </StrictMode>,
  );

beforeEach(() => {
  verifyEmail.mockReset();
  resendVerification.mockReset();
});

describe('VerifyEmailPage', () => {
  it('envia el token una sola vegada (encara que StrictMode repeteixi l\'efecte)', async () => {
    verifyEmail.mockResolvedValue('Correo verificado. Ya puedes iniciar sesión.');
    renderAt('/verificar?token=abc');
    expect(await screen.findByText('Correo verificado. Ya puedes iniciar sesión.')).toBeTruthy();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith('abc');
  });

  it('si l\'enllaç ha caducat permet demanar-ne un de nou', async () => {
    verifyEmail.mockRejectedValue(new ApiRequestError('El enlace ha caducado. Pide uno nuevo.', { status: 400, code: 'TOKEN_EXPIRED' }));
    renderAt('/verificar?token=vell');
    expect(await screen.findByText('El enlace ha caducado. Pide uno nuevo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar un enlace nuevo' })).toBeTruthy();
  });

  it('sense token mostra l\'error sense cridar l\'API', () => {
    renderAt('/verificar');
    expect(screen.getByText('El enlace no es válido.')).toBeTruthy();
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
