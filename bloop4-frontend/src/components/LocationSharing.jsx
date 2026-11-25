import { useEffect, useRef, useState } from 'react';
import { sendLocation } from '../api/riderApi';

// Decisió del Sprint 2: la posició s'envia cada 10 s mentre dura el lliurament.
export const LOCATION_SEND_MS = 10_000;

const MESSAGES = {
  starting: 'Buscando tu ubicación…',
  sharing: 'Estás compartiendo tu ubicación con el cliente mientras dura la entrega. Se deja de compartir al completarla.',
  denied: 'No has dado permiso para usar tu ubicación: el cliente no podrá ver por dónde vas. Puedes activarlo en los ajustes del navegador.',
  unavailable: 'Este dispositivo no puede obtener tu ubicación ahora mismo.',
  stopped: 'La entrega ya no está en curso: hemos dejado de compartir tu ubicación.',
};

/**
 * Comparteix la posició del rider amb el client durant un lliurament en curs (US-16). Avisa el rider
 * que s'està compartint i deixa de fer-ho en desmuntar-se (el servei s'ha completat) o si l'API
 * diu que el lliurament ja no està en curs.
 */
export default function LocationSharing({ serviceId, geolocation = globalThis.navigator?.geolocation }) {
  const [status, setStatus] = useState(geolocation ? 'starting' : 'unavailable');
  const latest = useRef(null);
  const lastSent = useRef(0);
  const stopped = useRef(false);

  useEffect(() => {
    if (!geolocation) return undefined;
    stopped.current = false;

    async function send() {
      const position = latest.current;
      if (!position || stopped.current || Date.now() - lastSent.current < LOCATION_SEND_MS) return;
      lastSent.current = Date.now();
      try {
        await sendLocation(serviceId, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? undefined,
        });
      } catch (err) {
        // 409: el lliurament ja no està en curs. La resta d'errors (xarxa, 429) es reintenten sols.
        if (err.status === 409) {
          stopped.current = true;
          setStatus('stopped');
        }
      }
    }

    const watchId = geolocation.watchPosition(
      (position) => {
        latest.current = position;
        if (!stopped.current) setStatus('sharing');
        send();
      },
      (error) => setStatus(error.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    // Si el rider està aturat, el navegador pot no avisar de cap posició nova: es reenvia l'última.
    const timer = setInterval(send, LOCATION_SEND_MS);
    return () => {
      stopped.current = true;
      geolocation.clearWatch(watchId);
      clearInterval(timer);
    };
  }, [serviceId, geolocation]);

  return (
    <p className={`location-sharing location-sharing--${status}`} role="status">
      {MESSAGES[status]}
    </p>
  );
}
