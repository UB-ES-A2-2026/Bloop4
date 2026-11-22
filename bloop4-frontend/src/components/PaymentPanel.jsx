import { useState } from 'react';
import { startPayment } from '../api/bookingApi';
import { formatPrice } from '../lib/format';
import { formatDateTime } from '../lib/dates';

/** Envia el navegador a la pàgina de pagament de la passarel·la. Separat per poder-lo simular als tests. */
export const redirectTo = (url) => window.location.assign(url);

function DepositStatus({ deposit }) {
  if (!deposit) return null;
  const amount = formatPrice(deposit.amount, deposit.currency);
  if (deposit.status === 'failed') {
    return (
      <p className="form__error" role="alert">
        No hemos podido retener la fianza de {amount} en tu tarjeta. Ponte en contacto con nosotros para resolverlo antes de la entrega.
      </p>
    );
  }
  // Cada text es calcula només per al seu estat: `scheduledFor` només existeix si està programada.
  const texts = {
    scheduled: () =>
      `La fianza de ${amount} todavía no se retiene: lo haremos el ${formatDateTime(deposit.scheduledFor)}, 7 días antes de la entrega. No se cobra.`,
    held: () => `Fianza de ${amount} retenida en tu tarjeta. No se cobra: se libera cuando devuelvas el material en buen estado.`,
    released: () => `Fianza de ${amount} liberada.`,
  };
  const text = texts[deposit.status]?.();
  return text ? <p className="form__hint">{text}</p> : null;
}

/**
 * Pagament d'una reserva. Pendent: botó per anar a pagar a la passarel·la (les dades de la targeta
 * no s'escriuen mai en aquesta app). Pagada: comprovant i estat de la fiança.
 * `returned`: 'ok' | 'cancelado' | null, segons com ha tornat el client de la passarel·la.
 */
export default function PaymentPanel({ booking, payment, returned, canPay, onRedirect = redirectTo }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function pay() {
    setSending(true);
    setError(null);
    try {
      const { checkoutUrl } = await startPayment(booking.id);
      onRedirect(checkoutUrl);
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  if (payment?.status === 'succeeded') {
    return (
      <section className="payment" aria-labelledby="payment-title">
        <h2 id="payment-title" className="detail__subtitle">Comprobante de pago</h2>
        <dl className="payment__receipt">
          <div>
            <dt>Comprobante</dt>
            <dd>{payment.receiptNumber}</dd>
          </div>
          <div>
            <dt>Pagado el</dt>
            <dd>{formatDateTime(payment.paidAt)}</dd>
          </div>
          <div>
            <dt>Importe cobrado</dt>
            <dd>{formatPrice(payment.amount, payment.currency)}</dd>
          </div>
        </dl>
        <DepositStatus deposit={payment.deposit} />
        <button type="button" className="btn-outline payment__print" onClick={() => window.print()}>Imprimir comprobante</button>
      </section>
    );
  }

  if (payment?.status === 'refunded') {
    return (
      <p className="booking__notice booking__notice--expired" role="alert">
        Tu pago llegó cuando el tiempo para pagar ya había terminado. Te hemos devuelto el importe íntegro.
      </p>
    );
  }

  if (booking.status !== 'pending_payment') return null;

  // El client ha pagat però l'avís de la passarel·la encara no ha arribat: es continua consultant.
  if (returned === 'ok') {
    return <p className="booking__notice" role="status" aria-busy="true">Estamos confirmando tu pago…</p>;
  }

  return (
    <section className="payment" aria-labelledby="payment-title">
      <h2 id="payment-title" className="detail__subtitle">Pago</h2>
      {returned === 'cancelado' && <p className="form__error" role="status">Has cancelado el pago. No se ha cobrado nada.</p>}
      {payment?.status === 'failed' && (
        <p className="form__error" role="alert">
          {payment.failureReason ?? 'El pago ha sido rechazado'}. No se ha cobrado nada: puedes volver a intentarlo.
        </p>
      )}
      <p className="auth-page__text">
        Pagarás <strong>{formatPrice(booking.totals.toPay, booking.currency)}</strong> en una sola operación
        {booking.sellers.length > 1 ? `, aunque tu reserva incluye material de ${booking.sellers.length} empresas` : ''}.
        {Number(booking.totals.deposit) > 0 && ` La fianza de ${formatPrice(booking.totals.deposit, booking.currency)} solo se retiene: no se cobra.`}
      </p>
      {error && <p className="form__error" role="alert">{error}</p>}
      <button type="button" className="btn-primary" onClick={pay} disabled={sending || !canPay}>
        {sending ? 'Abriendo el pago…' : payment?.status === 'failed' ? 'Reintentar el pago' : 'Pagar con tarjeta'}
      </button>
      <p className="form__hint">
        Introducirás los datos de tu tarjeta en la página segura del proveedor de pagos. Bloop4 no los ve ni los guarda.
      </p>
    </section>
  );
}
