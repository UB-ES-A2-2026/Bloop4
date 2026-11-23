import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentPanel from './PaymentPanel';
import { startPayment } from '../api/bookingApi';
import { ApiRequestError } from '../api/http';
import { makeBooking } from '../test/fixtures';

vi.mock('../api/bookingApi', () => ({ startPayment: vi.fn() }));

const paid = (deposit = null) => ({
  status: 'succeeded', amount: '205.00', currency: 'EUR', receiptNumber: 'R-2030-000001', paidAt: '2030-01-01T10:05:00Z', deposit,
});

// Sense mockReset al beforeEach: amb vitest 2.1, un mock reiniciat que rebutja la promesa fa
// fallar el test encara que el component capturi l'error. Cada test fixa la seva implementació.

describe('PaymentPanel', () => {
  it('mostra el total que es cobrarà i que la fiança només es reté', () => {
    render(<PaymentPanel booking={makeBooking()} payment={{ status: 'none' }} canPay />);
    const text = screen.getByText(/Pagarás/).textContent;
    expect(text).toMatch(/205\s€/);
    expect(text).toMatch(/La fianza de 300\s€ solo se retiene: no se cobra/);
    expect(screen.getByText(/Bloop4 no los ve ni los guarda/)).toBeTruthy();
  });

  it('«Pagar con tarjeta» inicia el pagament i envia a la pàgina de la passarel·la', async () => {
    startPayment.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    const onRedirect = vi.fn();
    render(<PaymentPanel booking={makeBooking()} payment={{ status: 'none' }} canPay onRedirect={onRedirect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));
    await waitFor(() => expect(onRedirect).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1'));
    expect(startPayment).toHaveBeenCalledWith('b1');
  });

  it('no hi ha cap camp per escriure dades de targeta', () => {
    const { container } = render(<PaymentPanel booking={makeBooking()} payment={{ status: 'none' }} canPay />);
    expect(container.querySelector('input')).toBeNull();
  });

  it('un error de l\'API en iniciar el pagament es mostra', async () => {
    startPayment.mockImplementation(async () => {
      throw new ApiRequestError('El tiempo para pagar ha terminado', { status: 409 });
    });
    render(<PaymentPanel booking={makeBooking()} payment={{ status: 'none' }} canPay />);
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta' }));
    expect((await screen.findByRole('alert')).textContent).toBe('El tiempo para pagar ha terminado');
  });

  it('si el bloqueig ha caducat el botó de pagar està desactivat', () => {
    render(<PaymentPanel booking={makeBooking()} payment={{ status: 'none' }} canPay={false} />);
    expect(screen.getByRole('button', { name: 'Pagar con tarjeta' }).disabled).toBe(true);
  });

  it('un pagament rebutjat o cancel·lat s\'explica i es pot reintentar', () => {
    const { rerender } = render(
      <PaymentPanel booking={makeBooking()} payment={{ status: 'failed', failureReason: 'La tarjeta ha sido rechazada' }} canPay />,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/La tarjeta ha sido rechazada\. No se ha cobrado nada/);
    expect(screen.getByRole('button', { name: 'Reintentar el pago' })).toBeTruthy();

    rerender(<PaymentPanel booking={makeBooking()} payment={{ status: 'cancelled' }} returned="cancelado" canPay />);
    expect(screen.getByText('Has cancelado el pago. No se ha cobrado nada.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pagar con tarjeta' })).toBeTruthy();
  });

  it('en tornar de pagar, mentre no arriba la confirmació no ofereix tornar a pagar', () => {
    render(<PaymentPanel booking={makeBooking()} payment={{ status: 'pending' }} returned="ok" canPay />);
    expect(screen.getByRole('status').textContent).toBe('Estamos confirmando tu pago…');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('un cop pagada mostra el comprovant i l\'estat de la fiança', () => {
    const booking = makeBooking({ status: 'confirmed' });
    const { rerender } = render(
      <PaymentPanel booking={booking} payment={paid({ status: 'scheduled', amount: '300.00', currency: 'EUR', scheduledFor: '2030-06-27T06:00:00Z' })} canPay />,
    );
    expect(screen.getByText('Comprobante').nextSibling.textContent).toBe('R-2030-000001');
    expect(screen.getByText('Importe cobrado').nextSibling.textContent).toMatch(/^205\s€$/);
    expect(screen.getByText(/todavía no se retiene.*7 días antes de la entrega/)).toBeTruthy();

    rerender(<PaymentPanel booking={booking} payment={paid({ status: 'held', amount: '300.00', currency: 'EUR' })} canPay />);
    expect(screen.getByText(/Fianza de 300\s€ retenida en tu tarjeta\. No se cobra/)).toBeTruthy();

    rerender(<PaymentPanel booking={booking} payment={paid({ status: 'failed', amount: '300.00', currency: 'EUR' })} canPay />);
    expect(screen.getByRole('alert').textContent).toMatch(/No hemos podido retener la fianza de 300\s€/);

    rerender(<PaymentPanel booking={booking} payment={paid()} canPay />);
    expect(screen.queryByText(/[Ff]ianza/)).toBeNull();
  });

  it('un pagament retornat avisa que s\'ha tornat l\'import', () => {
    render(<PaymentPanel booking={makeBooking({ status: 'cancelled' })} payment={{ status: 'refunded' }} canPay />);
    expect(screen.getByRole('alert').textContent).toMatch(/Te hemos devuelto el importe íntegro/);
  });
});
