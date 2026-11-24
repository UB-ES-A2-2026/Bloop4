import { Suspense, lazy, useCallback } from 'react';
import { fetchLocations } from '../api/bookingApi';
import { usePolling } from '../hooks/usePolling';

// Leaflet només es descarrega quan hi ha un lliurament en curs per mostrar.
const RiderMap = lazy(() => import('./RiderMap'));

export const LOCATIONS_POLL_MS = 10_000;

/** "fa 25 s", "fa 3 min" a partir d'una data. */
export function ago(date, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `hace ${minutes} min` : `hace ${Math.round(minutes / 60)} h`;
}

function ActiveDelivery({ delivery, stale }) {
  const { location, seller } = delivery;
  return (
    <section className="delivery-map" aria-label={`Entrega de ${seller.legalName}`}>
      <h3 className="detail__subtitle">Entrega de {seller.legalName}: en camino</h3>
      {location ? (
        <>
          <Suspense fallback={<div className="rider-map skeleton" aria-busy="true" aria-label="Cargando el mapa" />}>
            <RiderMap
              latitude={location.latitude}
              longitude={location.longitude}
              accuracy={location.accuracy}
              label={`Repartidor de ${seller.legalName}`}
            />
          </Suspense>
          <p className="form__hint">Ubicación actualizada {ago(location.recordedAt)}.</p>
          {location.stale && (
            <p className="form__error" role="status">
              Hace un rato que no recibimos la ubicación del repartidor. Puedes seguir el estado de la entrega más abajo.
            </p>
          )}
        </>
      ) : (
        <p className="form__hint" role="status">
          La ubicación del repartidor todavía no está disponible. Puedes seguir el estado de la entrega más abajo.
        </p>
      )}
      {stale && <p className="form__hint">No hemos podido actualizar el mapa: puede que la posición no esté al día.</p>}
    </section>
  );
}

/**
 * Mapa de cada lliurament en curs de la reserva (US-16), actualitzat cada 10 s. Si no n'hi ha cap
 * en curs, no mostra res: la ubicació només es comparteix durant el trajecte.
 */
export default function DeliveryTracking({ bookingId }) {
  const load = useCallback((signal) => fetchLocations(bookingId, { signal }), [bookingId]);
  const { data, stale } = usePolling(load, LOCATIONS_POLL_MS);
  if (!data?.length) return null;
  return (
    <div className="delivery-maps">
      {data.map((delivery) => (
        <ActiveDelivery key={delivery.serviceId} delivery={delivery} stale={stale} />
      ))}
    </div>
  );
}
