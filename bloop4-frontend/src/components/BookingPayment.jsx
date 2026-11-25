import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PaymentPanel from './PaymentPanel';
import { fetchPayment } from '../api/bookingApi';
import { useCountdown } from '../hooks/useCountdown';

// En tornar de la passarel·la, el pagament pot trigar uns segons a confirmar-se (arriba pel webhook).
const CONFIRM_POLL_MS = 2000;

/**
 * Pagament de la reserva (US-08): l'estat del pagament i de la fiança i, mentre està pendent, el
 * botó per pagar (fins que caduca el bloqueig). En tornar de la passarel·la (`?pago=ok`) es torna
 * a llegir la reserva (`reload`) fins que consta com a confirmada.
 */
export default function BookingPayment({ booking, reload }) {
  const [params] = useSearchParams();
  // 'ok' o 'cancelado': com ha tornat el client de la pàgina de pagament.
  const returned = params.get('pago');
  const [payment, setPayment] = useState(null);
  const expired = useCountdown(booking.status === 'pending_payment' ? booking.holdExpiresAt : null) === 0;

  // L'estat del pagament és informació addicional: si falla, la reserva es mostra igualment.
  useEffect(() => {
    const controller = new AbortController();
    fetchPayment(booking.id, { signal: controller.signal }).then(setPayment, () => {});
    return () => controller.abort();
  }, [booking.id, booking.status]);

  // El client ha tornat de pagar però la reserva encara no consta com a confirmada.
  const awaitingPayment = returned === 'ok' && booking.status === 'pending_payment' && !expired;
  useEffect(() => {
    if (!awaitingPayment) return undefined;
    const timer = setInterval(reload, CONFIRM_POLL_MS);
    return () => clearInterval(timer);
  }, [awaitingPayment, reload]);

  return <PaymentPanel booking={booking} payment={payment} returned={returned} canPay={!expired} />;
}
