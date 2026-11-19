import { SERVICE_STATUS_LABEL } from '../lib/services';

/** Estat d'un servei assignat, amb l'avís si ha canviat després d'acceptar-lo. */
export default function ServiceStatus({ service }) {
  return (
    <span className="service__status">
      <span className={`badge badge--service-${service.status}`}>{SERVICE_STATUS_LABEL[service.status] ?? service.status}</span>
      {service.changedSinceAssigned && service.status !== 'cancelled' && (
        <span className="badge badge--changed" title="La franja o el vehículo han cambiado desde que lo aceptaste">
          Modificado
        </span>
      )}
    </span>
  );
}
