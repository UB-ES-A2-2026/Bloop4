import { useCallback } from 'react';
import TrackingTimeline from './TrackingTimeline';
import { fetchTracking } from '../api/bookingApi';
import { usePolling } from '../hooks/usePolling';

// El seguiment dels lliuraments es torna a demanar cada 10 s (decisió del Sprint 2: sense SSE).
export const TRACKING_POLL_MS = 10_000;

/** Seguiment d'una reserva confirmada, actualitzat sol. */
export default function LiveTracking({ bookingId }) {
  const load = useCallback((signal) => fetchTracking(bookingId, { signal }), [bookingId]);
  const { data, stale, status } = usePolling(load, TRACKING_POLL_MS);
  if (status === 'error') return <p className="form__hint" role="status">El seguimiento no está disponible ahora mismo.</p>;
  if (!data) return null;
  return <TrackingTimeline tracking={data} stale={stale} />;
}
