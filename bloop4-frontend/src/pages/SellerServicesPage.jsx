import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusPanel from '../components/StatusPanel';
import { fetchSellerServices } from '../api/proofApi';
import { SERVICE_STATUS_LABEL, SERVICE_TYPE_LABEL } from '../lib/services';
import { formatDateTime } from '../lib/dates';

/** Pàgina /vendedor/servicios: entregues i recollides del material del venedor, amb les proves. */
export default function SellerServicesPage() {
  const [state, setState] = useState({ status: 'loading', services: [], error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchSellerServices({ signal: controller.signal })
      .then((services) => setState({ status: 'success', services, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', services: [], error });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="detail-page" aria-labelledby="seller-services-title">
      <div className="eyebrow">Panel del vendedor</div>
      <h1 id="seller-services-title" className="catalog__title">Entregas y recogidas</h1>
      {state.status === 'loading' && <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando servicios" />}
      {state.status === 'error' && (
        <StatusPanel role="alert" title="No se pudieron cargar los servicios" text={state.error?.message} actionLabel="Reintentar" onAction={() => setAttempt((n) => n + 1)} />
      )}
      {state.status === 'success' && state.services.length === 0 && <StatusPanel title="Todavía no hay entregas" text="Cuando se confirme una reserva con tu material, la verás aquí." />}
      {state.status === 'success' && state.services.length > 0 && (
        <table className="seller-table">
          <thead>
            <tr>
              <th scope="col">Reserva</th>
              <th scope="col">Servicio</th>
              <th scope="col">Franja</th>
              <th scope="col">Estado</th>
              <th scope="col">Prueba</th>
            </tr>
          </thead>
          <tbody>
            {state.services.map((s) => (
              <tr key={s.id}>
                <td>{s.bookingNumber}</td>
                <td>{SERVICE_TYPE_LABEL[s.type]}</td>
                <td>{formatDateTime(s.timeWindow.startsAt)}</td>
                <td>
                  {s.status === 'pending' ? 'Sin repartidor' : SERVICE_STATUS_LABEL[s.status]}
                  {s.openIncidents > 0 && <span className="badge badge--service-incident"> Incidencia abierta</span>}
                </td>
                <td>{s.hasProof || s.openIncidents > 0 ? <Link to={`/pruebas/${s.id}`}>Ver prueba</Link> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
