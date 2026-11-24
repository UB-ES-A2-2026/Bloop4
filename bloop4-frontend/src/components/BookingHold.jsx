import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cancelBooking } from '../api/bookingApi';
import { useCountdown } from '../hooks/useCountdown';
import { formatCountdown } from '../lib/bookings';

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

/**
 * Bloqueig de la reserva (US-12): mentre està pendent de pagament, el compte enrere i l'opció de
 * tornar a la cistella; un cop confirmada, el número de reserva.
 */
export default function BookingHold({ booking }) {
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);

  async function cancel() {
    setCancelling(true);
    setError(null);
    try {
      await cancelBooking(booking.id);
      navigate('/reserva');
    } catch (err) {
      setError(err.message);
      setCancelling(false);
    }
  }

  return (
    <>
      {booking.status === 'pending_payment' && <PendingHold booking={booking} onCancel={cancel} cancelling={cancelling} />}
      {booking.status === 'confirmed' && (
        <p className="booking__notice booking__notice--ok" role="status">
          Tu reserva está confirmada. Número de reserva: <strong>{booking.bookingNumber}</strong>
        </p>
      )}
      {error && <p className="form__error" role="alert">{error}</p>}
    </>
  );
}
