import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BookingSummary from '../components/BookingSummary';
import StatusPanel from '../components/StatusPanel';
import { fetchBooking } from '../api/bookingApi';
import { BOOKING_STATUS_LABEL } from '../lib/bookings';
// Sprint 2: cada història importa el que mostra a la reserva dins de la seva zona (vegeu CONTRIBUTING.md).
// ── US-12 ──
import BookingHold from '../components/BookingHold';
// ── US-08 ──
import BookingPayment from '../components/BookingPayment';
// ── US-09 ──
// ── US-16 ──
import DeliveryTracking from '../components/DeliveryTracking';
// ── fi de les zones ──

/**
 * Pàgina /reservas/:id: estat de la reserva, número i resum (fonaments del Sprint 2). Cada història
 * hi afegeix el seu bloc dins de la seva zona; `load` torna a llegir la reserva.
 */
export default function BookingPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', booking: null, error: null });

  const load = useCallback(() => {
    const controller = new AbortController();
    fetchBooking(id, { signal: controller.signal })
      .then((booking) => setState({ status: 'success', booking, error: null }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState((current) =>
          // Durant una consulta periòdica, un error puntual no esborra el que ja es veu.
          current.booking ? current : { status: error.status === 404 ? 'notFound' : 'error', booking: null, error },
        );
      });
    return () => controller.abort();
  }, [id]);
  useEffect(load, [load]);

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
      {/* ── US-12 ── */}
      <BookingHold booking={booking} />
      {/* ── US-16 ── */}
      {booking.status === 'confirmed' && <DeliveryTracking bookingId={booking.id} />}
      {/* ── US-09 ── */}
      {/* ── fi de les zones ── */}
      <BookingSummary booking={booking} />
      {/* ── US-08 ── */}
      <BookingPayment booking={booking} reload={load} />
      {/* ── fi de les zones ── */}
    </section>
  );
}
