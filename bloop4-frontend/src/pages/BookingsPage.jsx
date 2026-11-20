import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusPanel from '../components/StatusPanel';
import { fetchBookings } from '../api/bookingApi';
import { BOOKING_STATUS_LABEL } from '../lib/bookings';
import { formatDateTime } from '../lib/dates';

/** Pàgina /reservas: les reserves del client, de la més recent a la més antiga. */
export default function BookingsPage() {
  const [state, setState] = useState({ status: 'loading', bookings: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    fetchBookings({ signal: controller.signal })
      .then((bookings) => setState({ status: 'success', bookings, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', bookings: [], error });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="detail-page" aria-labelledby="bookings-title">
      <h1 id="bookings-title" className="detail__title">Mis reservas</h1>

      {state.status === 'loading' && <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando reservas" />}
      {state.status === 'error' && (
        <StatusPanel role="alert" title="No se pudieron cargar tus reservas" text={state.error?.message} actionLabel="Reintentar" onAction={() => setAttempt((n) => n + 1)} />
      )}
      {state.status === 'success' && state.bookings.length === 0 && (
        <StatusPanel title="Todavía no tienes reservas" text="Cuando confirmes tu reserva la verás aquí." />
      )}
      {state.status === 'success' && state.bookings.length > 0 && (
        <table className="seller-table">
          <thead>
            <tr>
              <th scope="col">Reserva</th>
              <th scope="col">Estado</th>
              <th scope="col">Evento</th>
            </tr>
          </thead>
          <tbody>
            {state.bookings.map((booking) => (
              <tr key={booking.id}>
                <td>
                  <Link to={`/reservas/${booking.id}`}>{booking.bookingNumber}</Link>
                </td>
                <td>
                  <span className={`badge badge--${booking.status}`}>{BOOKING_STATUS_LABEL[booking.status] ?? booking.status}</span>
                </td>
                <td>{formatDateTime(booking.startsAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
