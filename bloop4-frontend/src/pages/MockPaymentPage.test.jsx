import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MockPaymentPage from './MockPaymentPage';
import { completeMockPayment } from '../api/bookingApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/bookingApi', () => ({ completeMockPayment: vi.fn() }));

const OK = `${window.location.origin}/reservas/b1?pago=ok`;
const CANCEL = `${window.location.origin}/reservas/b1?pago=cancelado`;
const url = (ok = OK) => `/pago-simulado?${new URLSearchParams({ ref: 'mock_cs_1', ok, cancel: CANCEL })}`;

function renderPage(entry = url()) {
  const onRedirect = vi.fn();
  render(
    <MemoryRouter initialEntries={[entry]}>
      <MockPaymentPage onRedirect={onRedirect} />
    </MemoryRouter>,
  );
  return onRedirect;
}
const pay = (card) => {
  fireEvent.change(screen.getByLabelText('Tarjeta de prueba'), { target: { value: card } });
  fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
};

beforeEach(() => completeMockPayment.mockReset());

describe('MockPaymentPage', () => {
  it('avisa que és un entorn de proves i que no es cobra res', () => {
    renderPage();
    expect(screen.getByRole('note').textContent).toMatch(/No se realiza ningún cobro: no escribas una tarjeta real/);
  });

  it('amb la targeta de prova paga i torna a la reserva', async () => {
    completeMockPayment.mockResolvedValue({ result: 'succeeded' });
    const onRedirect = renderPage();
    pay('4242 4242 4242 4242');
    await waitFor(() => expect(onRedirect).toHaveBeenCalledWith('/reservas/b1?pago=ok'));
    expect(completeMockPayment).toHaveBeenCalledWith('mock_cs_1', '4242 4242 4242 4242');
  });

  it('una targeta rebutjada o que no és de prova mostra l\'error i no surt de la pàgina', async () => {
    completeMockPayment.mockResolvedValueOnce({ result: 'failed' });
    const onRedirect = renderPage();
    pay('4000 0000 0000 0002');
    expect((await screen.findByRole('alert')).textContent).toMatch(/La tarjeta ha sido rechazada/);

    completeMockPayment.mockRejectedValueOnce(new ApiRequestError('Usa una tarjeta de prueba: 4242 4242 4242 4242', { status: 400 }));
    pay('5555 5555 5555 4444');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Usa una tarjeta de prueba: 4242 4242 4242 4242'));
    expect(onRedirect).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Cancelar y volver a la reserva' }).getAttribute('href')).toBe('/reservas/b1?pago=cancelado');
  });

  it('no redirigeix mai fora de l\'app encara que la URL de tornada sigui d\'un altre lloc', async () => {
    completeMockPayment.mockResolvedValue({ result: 'succeeded' });
    const onRedirect = renderPage(url('https://evil.example/phishing'));
    pay('4242 4242 4242 4242');
    await waitFor(() => expect(onRedirect).toHaveBeenCalledWith('/reservas'));
  });

  it('sense sessió de pagament a la URL no mostra el formulari', () => {
    renderPage('/pago-simulado');
    expect(screen.getByRole('alert').textContent).toBe('Sesión de pago no válida');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
