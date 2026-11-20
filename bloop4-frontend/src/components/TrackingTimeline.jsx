import { formatDateTime } from '../lib/dates';
// Sprint 2: cada història importa el que afegeix al seguiment dins de la seva zona (vegeu CONTRIBUTING.md).
// ── US-11 ──
// ── fi de les zones ──

// Fases que veu el client per a cada empresa, en ordre.
const STEPS = [
  { key: 'confirmed', label: 'Confirmada' },
  { key: 'delivery_in_transit', label: 'En camino', service: 'delivery', status: 'in_transit' },
  { key: 'delivered', label: 'Entregada', service: 'delivery', status: 'delivered' },
  { key: 'pickup_in_transit', label: 'En recogida', service: 'pickup', status: 'in_transit' },
  { key: 'picked_up', label: 'Recogida', service: 'pickup', status: 'delivered' },
];
const ORDER = STEPS.map((s) => s.key);

/** Hora en què el servei va arribar a l'estat (última vegada), o null. */
const reachedAt = (service, status) => [...(service?.history ?? [])].reverse().find((h) => h.status === status)?.at ?? null;

function SellerTracking({ group }) {
  const current = ORDER.indexOf(group.phase);
  const incident = [group.delivery, group.pickup].find((s) => s?.status === 'incident');
  const delayed = [group.delivery, group.pickup].find((s) => s?.delayed);
  return (
    <section className="tracking__seller" aria-label={`Seguimiento de ${group.seller.legalName}`}>
      <h3 className="detail__subtitle">{group.seller.legalName}</h3>
      <ol className="tracking__steps">
        {STEPS.map((step, i) => {
          const done = current >= i;
          const at = step.service ? reachedAt(group[step.service], step.status) : null;
          return (
            <li key={step.key} className={`tracking__step${done ? ' tracking__step--done' : ''}${current === i ? ' tracking__step--current' : ''}`} aria-current={current === i ? 'step' : undefined}>
              <span className="tracking__label">{step.label}</span>
              {done && at && <span className="form__hint">{formatDateTime(at)}</span>}
            </li>
          );
        })}
      </ol>
      <p className="form__hint">
        {group.delivery && <>Entrega prevista: {formatDateTime(group.delivery.timeWindow.startsAt)} – {formatDateTime(group.delivery.timeWindow.endsAt)}. </>}
        {group.pickup && <>Recogida prevista: {formatDateTime(group.pickup.timeWindow.startsAt)} – {formatDateTime(group.pickup.timeWindow.endsAt)}.</>}
      </p>
      {incident && (
        <p className="tracking__incident" role="alert">
          Incidencia en la {incident.type === 'delivery' ? 'entrega' : 'recogida'}: nos pondremos en contacto contigo.
        </p>
      )}
      {!incident && delayed && (
        <p className="form__error" role="alert">
          La {delayed.type === 'delivery' ? 'entrega' : 'recogida'} va con retraso: la franja acordada ya ha terminado.
        </p>
      )}
      {group.phase === 'cancelled' && <p className="form__hint">Los servicios de esta empresa se han cancelado.</p>}
      {/* ── US-11 ── */}
      {/* ── fi de les zones ── */}
    </section>
  );
}

/**
 * Seguiment de la reserva per empresa. `stale`: l'última consulta ha fallat i el que es veu pot
 * no estar al dia.
 */
export default function TrackingTimeline({ tracking, stale }) {
  return (
    <section className="tracking" aria-labelledby="tracking-title">
      <h2 id="tracking-title" className="detail__subtitle">Seguimiento</h2>
      {stale && (
        <p className="form__hint" role="status">
          No hemos podido actualizar el seguimiento: puede que la información no esté al día. Lo seguimos intentando.
        </p>
      )}
      {tracking.sellers.map((group) => (
        <SellerTracking key={group.seller.id} group={group} />
      ))}
      <p className="form__hint">Actualizado a las {new Date(tracking.checkedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.</p>
    </section>
  );
}
