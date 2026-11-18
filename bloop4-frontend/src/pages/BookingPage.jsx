import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import BookingSummary from '../components/BookingSummary';
import StatusPanel from '../components/StatusPanel';
import { cancelBooking, fetchBooking } from '../api/bookingApi';
import { useCountdown } from '../hooks/useCountdown';
import { BOOKING_STATUS_LABEL, formatCountdown } from '../lib/bookings';

/** Reserva pendent de pagament: compte enrere del bloqueig i opció de tornar a la cistella. */
function PendingHold({ booking, onCancel, cancelling }) {
  const seconds = useCountdown(booking.holdExpiresAt);

  if (seconds === 0) {
    return (
      <div className="booking__notice booking__notice--expired" role="alert">
        <p>
          <strong>El tiempo para pagar ha terminado.</strong> Hemos liberado el material: vuelve a tu reserva para
          comprobar la disponibilidad antes de continuar.
        </p>
        <Link className="btn-primary" to="/reserva">Volver a mi reserva</Link>
      </div>
    );
  }
  return (
    <div className="booking__notice">
      <p>
        Te guardamos el material durante{' '}
        <strong className="booking__countdown" role="timer" aria-label="Tiempo restante para pagar">
          {formatCountdown(seconds)}
        </strong>{' '}
        mientras completas el pago.
      </p>
      <button type="button" className="link-button" onClick={onCancel} disabled={cancelling}>
        Cancelar y volver a mi reserva
      </button>
    </div>
  );
}

/** Pàgina /reservas/:id: estat de la reserva, número i resum. */
export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', booking: null, error: null });
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    fetchBooking(id, { signal: controller.signal })
      .then((booking) => setState({ status: 'success', booking, error: null }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: error.status === 404 ? 'notFound' : 'error', booking: null, error });
      });
    return () => controller.abort();
  }, [id]);
  useEffect(load, [load]);

  async function cancel() {
    setCancelling(true);
    setActionError(null);
    try {
      await cancelBooking(id);
      navigate('/reserva');
    } catch (err) {
      setActionError(err.message);
      setCancelling(false);
    }
  }

  if (state.status === 'loading') return <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando la reserva" />;
  if (state.status === 'notFound') {
    return (
      <div className="empty-state" role="status">
        <h1 className="empty-state__title">Reserva no encontrada</h1>
        <p className="empty-state__text">Si el tiempo para pagar terminó, el material vuelve a estar en tu reserva.</p>
        <Link className="btn-primary" to="/reserva">Ir a mi reserva</Link>
      </div>
    );
  }
  if (state.status === 'error') {
    return <StatusPanel role="alert" title="No se pudo cargar la reserva" text={state.error?.message} actionLabel="Reintentar" onAction={load} />;
  }

  const { booking } = state;
  return (
    <section className="detail-page" aria-labelledby="booking-title">
      <Link className="detail__back" to="/reservas">← Mis reservas</Link>
      <div className="eyebrow">Reserva {booking.bookingNumber}</div>
      <h1 id="booking-title" className="detail__title">
        {BOOKING_STATUS_LABEL[booking.status] ?? booking.status}
      </h1>

      {booking.status === 'pending_payment' && <PendingHold booking={booking} onCancel={cancel} cancelling={cancelling} />}
      {booking.status === 'confirmed' && (
        <p className="booking__notice booking__notice--ok" role="status">
          Tu reserva está confirmada. Número de reserva: <strong>{booking.bookingNumber}</strong>
        </p>
      )}
      {actionError && <p className="form__error" role="alert">{actionError}</p>}

      <BookingSummary booking={booking} />
    </section>
  );
}
