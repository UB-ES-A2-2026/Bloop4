import { CONDITION_LABEL, INCIDENT_KIND_LABEL, SERVICE_TYPE_LABEL } from '../lib/services';
import { formatDateTime } from '../lib/dates';

/** Prova d'un servei: estat i fotos de cada línia, i incidències. */
export default function ProofView({ proof }) {
  return (
    <section className="proof-view" aria-labelledby="proof-view-title">
      <h2 id="proof-view-title" className="detail__subtitle">
        Prueba de la {SERVICE_TYPE_LABEL[proof.type].toLowerCase()} · {proof.seller.legalName}
      </h2>
      {proof.completedAt ? (
        <p className="form__hint">Registrada el {formatDateTime(proof.completedAt)}.</p>
      ) : (
        <p className="form__hint">Este servicio todavía no se ha completado.</p>
      )}
      {proof.completedAt && (
        <ul className="cart__lines">
          {proof.items.map((item) => (
            <li key={item.eventItemId} className="proof-view__line">
              <div className="booking__line">
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span className={`badge badge--condition-${item.condition}`}>{CONDITION_LABEL[item.condition]}</span>
              </div>
              {item.note && <p className="form__hint">{item.note}</p>}
              <ul className="photos__list" aria-label={`Fotos de ${item.name}`}>
                {item.photos.map((photo) => (
                  <li key={photo.id} className="photos__item">
                    <a href={photo.url} target="_blank" rel="noopener noreferrer">
                      <img src={photo.url} alt={`Foto de ${item.name}`} width="120" height="96" loading="lazy" />
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {proof.incidents.length > 0 && (
        <>
          <h3 className="detail__subtitle">Incidencias</h3>
          <ul className="cart__lines">
            {proof.incidents.map((incident) => (
              <li key={incident.id} className="proof-view__incident">
                <strong>{INCIDENT_KIND_LABEL[incident.kind]}</strong> · {incident.status === 'open' ? 'Pendiente de revisión' : 'Resuelta'}
                <p className="form__hint">{incident.description}</p>
                {incident.resolutionNote && <p className="form__hint">Resolución: {incident.resolutionNote}</p>}
                {incident.photoUrl && <img src={incident.photoUrl} alt="Foto de la incidencia" width="120" height="96" loading="lazy" />}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
