import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ServiceStatus from '../components/ServiceStatus';
import StatusPanel from '../components/StatusPanel';
import { fetchMyService } from '../api/riderApi';
import { SERVICE_TYPE_LABEL, mapsUrl, todayIso } from '../lib/services';
import { formatDateTime } from '../lib/dates';
// Sprint 2: cada història importa el que mostra al servei dins de la seva zona (vegeu CONTRIBUTING.md).
// ── US-09 ──
import StartService from '../components/StartService';
// ── US-16 ──
import LocationSharing from '../components/LocationSharing';
// ── US-11 ──
import ServiceProof from '../components/ServiceProof';
// ── fi de les zones ──

/**
 * Pàgina /repartidor/servicios/:id: tot el que el rider necessita per fer un servei (fonaments del
 * Sprint 2). Cada història hi afegeix el seu bloc dins de la seva zona: `showService` hi posa el
 * servei que retorna l'API després d'una acció i `load` el torna a llegir.
 */
export default function RiderServicePage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', service: null, error: null });
  const showService = useCallback((service) => setState({ status: 'success', service, error: null }), []);

  const load = useCallback(() => {
    const controller = new AbortController();
    fetchMyService(id, { signal: controller.signal })
      .then(showService)
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: error.status === 404 ? 'notFound' : 'error', service: null, error });
      });
    return () => controller.abort();
  }, [id, showService]);
  useEffect(load, [load]);

  if (state.status === 'loading') return <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando el servicio" />;
  if (state.status === 'notFound') {
    return (
      <div className="empty-state" role="status">
        <h1 className="empty-state__title">Servicio no encontrado</h1>
        <Link className="btn-primary" to="/repartidor">Mis servicios</Link>
      </div>
    );
  }
  if (state.status === 'error') {
    return <StatusPanel role="alert" title="No se pudo cargar el servicio" text={state.error?.message} actionLabel="Reintentar" onAction={load} />;
  }

  const { service } = state;
  // Dia local del servei, per tornar a la llista d'aquell dia.
  const day = todayIso(new Date(service.timeWindow.startsAt));
  return (
    <section className="detail-page" aria-labelledby="service-title">
      <Link className="detail__back" to={`/repartidor?dia=${day}`}>← Mis servicios</Link>
      <div className="eyebrow">Reserva {service.bookingNumber}</div>
      <h1 id="service-title" className="detail__title">
        {SERVICE_TYPE_LABEL[service.type]} · {formatDateTime(service.timeWindow.startsAt)}
      </h1>
      <ServiceStatus service={service} />
      {service.status === 'cancelled' && (
        <p className="booking__notice booking__notice--expired" role="alert">
          Este servicio se ha cancelado: no tienes que hacerlo.
        </p>
      )}

      <dl className="payment__receipt service__details">
        <div>
          <dt>Franja</dt>
          <dd>
            {formatDateTime(service.timeWindow.startsAt)} – {formatDateTime(service.timeWindow.endsAt)}
          </dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>
            {service.address.street}, {service.address.postalCode} {service.address.city}
          </dd>
        </div>
        <div>
          <dt>Cliente</dt>
          <dd>{service.customer.fullName}</dd>
        </div>
        <div>
          <dt>Recoger en</dt>
          <dd>
            {service.seller.legalName} · {service.seller.city}
          </dd>
        </div>
        <div>
          <dt>Vehículo</dt>
          <dd>{service.vehicle.name}</dd>
        </div>
      </dl>
      {service.address.accessInstructions && (
        <p className="auth-page__text">
          <strong>Instrucciones de acceso:</strong> {service.address.accessInstructions}
        </p>
      )}
      {/* ── US-09 ── */}
      <StartService service={service} onStarted={showService} />
      {/* ── fi de les zones ── */}
      <a className="btn-outline" href={mapsUrl(service.address)} target="_blank" rel="noopener noreferrer">
        Abrir en el mapa
      </a>

      {/* ── US-16 ── */}
      {service.status === 'in_transit' && service.type === 'delivery' && <LocationSharing serviceId={service.id} />}
      {/* ── US-11 ── */}
      <ServiceProof service={service} onCompleted={showService} reload={load} />
      {/* ── fi de les zones ── */}

      <h2 className="detail__subtitle">Material</h2>
      <ul className="cart__lines">
        {service.items.map((item) => (
          <li key={item.name} className="booking__line">
            <span>{item.name}</span>
            <strong>{item.quantity} ud.</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
