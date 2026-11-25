import { SERVICE_TYPE_LABEL, itemsSummary } from '../lib/services';
import { formatDateTime } from '../lib/dates';

/** Dades bàsiques d'un servei: tipus, franja, zona, vehicle, venedor i material. */
export default function ServiceSummary({ service, children }) {
  const { timeWindow, zone } = service;
  return (
    <article className={`service service--${service.type}`} aria-label={`${SERVICE_TYPE_LABEL[service.type]} ${formatDateTime(timeWindow.startsAt)}`}>
      <header className="service__header">
        <span className={`badge badge--${service.type}`}>{SERVICE_TYPE_LABEL[service.type]}</span>
        <strong className="service__time">
          {formatDateTime(timeWindow.startsAt)} – {new Date(timeWindow.endsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </strong>
      </header>
      <p className="service__zone">
        {zone.postalCode} {zone.city} · {service.vehicle.name}
      </p>
      <p className="form__hint">
        {service.seller.legalName} · {itemsSummary(service.items)}
      </p>
      {children}
    </article>
  );
}
