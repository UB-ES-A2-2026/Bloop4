import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ServiceStatus from '../components/ServiceStatus';
import ServiceSummary from '../components/ServiceSummary';
import StatusPanel from '../components/StatusPanel';
import { fetchMyServices } from '../api/riderApi';
import { todayIso } from '../lib/services';

/** Pàgina /repartidor: els serveis del rider del dia triat (per defecte, avui), per ordre d'hora. */
export default function MyServicesPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get('dia') ?? todayIso();
  const [state, setState] = useState({ status: 'loading', services: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    fetchMyServices(date, { signal: controller.signal })
      .then((services) => setState({ status: 'success', services, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', services: [], error });
      });
    return () => controller.abort();
  }, [date, attempt]);

  return (
    <section className="detail-page" aria-labelledby="my-services-title">
      <div className="eyebrow">Repartidor</div>
      <h1 id="my-services-title" className="detail__title">Mis servicios</h1>

      <label className="form__field rider__date">
        <span className="form__label">Día</span>
        <input className="form__input" type="date" value={date} onChange={(e) => e.target.value && setParams({ dia: e.target.value })} />
      </label>

      {state.status === 'loading' && <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando servicios" />}
      {state.status === 'error' && (
        <StatusPanel role="alert" title="No se pudieron cargar tus servicios" text={state.error?.message} actionLabel="Reintentar" onAction={() => setAttempt((n) => n + 1)} />
      )}
      {state.status === 'success' && state.services.length === 0 && (
        <StatusPanel title="No tienes servicios este día" text="Elige otro día o acepta servicios en «Servicios disponibles»." />
      )}
      {state.status === 'success' && state.services.length > 0 && (
        <ul className="service-list">
          {state.services.map((service) => (
            <li key={service.id}>
              <ServiceSummary service={service}>
                <ServiceStatus service={service} />
                <p className="service__address">
                  {service.address.street}, {service.address.postalCode} {service.address.city}
                </p>
                <Link className="link-button" to={`/repartidor/servicios/${service.id}`}>
                  Ver detalle
                </Link>
              </ServiceSummary>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
