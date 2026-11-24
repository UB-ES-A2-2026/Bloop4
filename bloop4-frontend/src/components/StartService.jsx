import { useState } from 'react';
import { startService } from '../api/riderApi';

/**
 * Botó per iniciar un servei assignat (US-09): passa a «En curso» i el client veu que el rider va de
 * camí. `onStarted` rep el servei actualitzat. Si l'API no ho deixa (p. ex. una recollida abans del
 * lliurament), se'n mostra el motiu.
 */
export default function StartService({ service, onStarted }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      onStarted(await startService(service.id));
    } catch (err) {
      setError(err.message);
    }
    setStarting(false);
  }

  return (
    <>
      {service.status === 'assigned' && (
        <div className="service__actions">
          <button type="button" className="btn-primary" onClick={start} disabled={starting}>
            {starting ? 'Iniciando…' : `Iniciar ${service.type === 'delivery' ? 'entrega' : 'recogida'}`}
          </button>
          <span className="form__hint">El cliente verá que vas de camino.</span>
        </div>
      )}
      {error && <p className="form__error" role="alert">{error}</p>}
    </>
  );
}
