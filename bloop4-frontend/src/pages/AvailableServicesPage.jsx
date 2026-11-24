import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ServiceSummary from '../components/ServiceSummary';
import StatusPanel from '../components/StatusPanel';
import { acceptService, fetchAvailableServices } from '../api/riderApi';
import { SERVICE_TYPE_LABEL } from '../lib/services';

/** Per què un rider no pot acceptar un servei de la llista (o null si pot). */
function blockedReason(service) {
  if (!service.fitsVehicle) return 'Tu vehículo no tiene capacidad suficiente';
  if (service.scheduleConflict) return 'Ya tienes otro servicio a esa hora';
  return null;
}

/** Pàgina /repartidor/disponibles: serveis de reserves confirmades que encara no té cap rider. */
export default function AvailableServicesPage() {
  const [state, setState] = useState({ status: 'loading', services: [], error: null });
  const [accepting, setAccepting] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    fetchAvailableServices({ signal: controller.signal })
      .then((services) => setState({ status: 'success', services, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', services: [], error });
      });
    return () => controller.abort();
  }, []);
  useEffect(load, [load]);

  async function accept(service) {
    setAccepting(service.id);
    setMessage(null);
    try {
      const assigned = await acceptService(service.id);
      setMessage({
        kind: 'ok',
        text: `${SERVICE_TYPE_LABEL[assigned.type]} aceptada: ${assigned.address.street}, ${assigned.address.postalCode} ${assigned.address.city}.`,
      });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    }
    setAccepting(null);
    // Tant si s'ha acceptat com si un altre rider s'ha avançat, la llista ha canviat.
    load();
  }

  return (
    <section className="detail-page" aria-labelledby="available-title">
      <div className="eyebrow">Repartidor</div>
      <h1 id="available-title" className="detail__title">Servicios disponibles</h1>

      {message && (
        <p className={message.kind === 'ok' ? 'booking__notice booking__notice--ok' : 'form__error'} role={message.kind === 'ok' ? 'status' : 'alert'}>
          {message.text}
          {message.kind === 'ok' && (
            <>
              {' '}
              <Link to="/repartidor">Ver mis servicios</Link>
            </>
          )}
        </p>
      )}

      {state.status === 'loading' && <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando servicios" />}
      {state.status === 'error' && (
        <StatusPanel role="alert" title="No se pudieron cargar los servicios" text={state.error?.message} actionLabel="Reintentar" onAction={load} />
      )}
      {state.status === 'success' && state.services.length === 0 && (
        <StatusPanel title="No hay servicios disponibles" text="Cuando se confirme una reserva nueva, sus entregas y recogidas aparecerán aquí." />
      )}
      {state.status === 'success' && state.services.length > 0 && (
        <ul className="service-list">
          {state.services.map((service) => {
            const blocked = blockedReason(service);
            return (
              <li key={service.id}>
                <ServiceSummary service={service}>
                  <div className="service__actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => accept(service)}
                      disabled={Boolean(blocked) || accepting !== null}
                      aria-describedby={blocked ? `blocked-${service.id}` : undefined}
                    >
                      {accepting === service.id ? 'Aceptando…' : 'Aceptar'}
                    </button>
                    {blocked && (
                      <span id={`blocked-${service.id}`} className="form__hint">
                        {blocked}
                      </span>
                    )}
                  </div>
                </ServiceSummary>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
