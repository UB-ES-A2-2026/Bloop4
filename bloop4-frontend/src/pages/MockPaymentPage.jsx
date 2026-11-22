import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { completeMockPayment } from '../api/bookingApi';

/** Només s'accepten tornades a la mateixa app (la URL ve de la query). */
function safeReturn(url) {
  try {
    const target = new URL(url, window.location.origin);
    return target.origin === window.location.origin ? `${target.pathname}${target.search}` : '/reservas';
  } catch {
    return '/reservas';
  }
}

/**
 * Pàgina /pago-simulado: fa de pàgina de pagament de la passarel·la simulada (PAYMENT_PROVIDER=mock).
 * No és un formulari de pagament real: només accepta targetes de prova i no es cobra res.
 */
export default function MockPaymentPage({ onRedirect = (url) => window.location.assign(url) }) {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [cardNumber, setCardNumber] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const { result } = await completeMockPayment(ref, cardNumber);
      if (result === 'succeeded') return onRedirect(safeReturn(params.get('ok')));
      setError('La tarjeta ha sido rechazada. Vuelve a la reserva para intentarlo de nuevo.');
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  }

  if (!ref) {
    return (
      <div className="empty-state" role="alert">
        <h1 className="empty-state__title">Sesión de pago no válida</h1>
      </div>
    );
  }

  return (
    <section className="auth-page" aria-labelledby="mock-pay-title">
      <div className="eyebrow">Entorno de pruebas</div>
      <h1 id="mock-pay-title" className="auth-page__title">Pago simulado</h1>
      <p className="booking__notice booking__notice--expired" role="note">
        Esta página sustituye a la del proveedor de pagos en desarrollo. No se realiza ningún cobro: no escribas una tarjeta real.
      </p>
      <form className="form" onSubmit={submit} noValidate>
        <label className="form__field">
          <span className="form__label">Tarjeta de prueba</span>
          <input
            className="form__input"
            name="cardNumber"
            inputMode="numeric"
            autoComplete="off"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
          />
        </label>
        <p className="form__hint">
          4242 4242 4242 4242 paga · 4000 0000 0000 0002 se rechaza · 4000 0000 0000 0341 paga y luego rechaza la fianza.
        </p>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? 'Pagando…' : 'Pagar'}
        </button>
      </form>
      <p className="auth-page__alt">
        <a href={safeReturn(params.get('cancel'))}>Cancelar y volver a la reserva</a>
      </p>
    </section>
  );
}
