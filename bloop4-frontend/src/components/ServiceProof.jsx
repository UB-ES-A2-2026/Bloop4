import { useState } from 'react';
import { Link } from 'react-router-dom';
import IncidentForm from './IncidentForm';
import ProofForm from './ProofForm';

/**
 * Prova del servei al detall del rider (US-11). En curs: checklist amb fotos per completar-lo o, si
 * no es pot, la incidència. Completat o amb incidència: l'enllaç a la prova. `onCompleted` rep el
 * servei completat i `reload` el torna a llegir després d'una incidència.
 */
export default function ServiceProof({ service, onCompleted, reload }) {
  const [reporting, setReporting] = useState(false);

  if (service.status === 'in_transit' && reporting) {
    return (
      <IncidentForm
        service={service}
        onReported={() => {
          setReporting(false);
          reload();
        }}
        onCancel={() => setReporting(false)}
      />
    );
  }
  if (service.status === 'in_transit') {
    return (
      <>
        <ProofForm service={service} onCompleted={onCompleted} />
        <button type="button" className="link-button" onClick={() => setReporting(true)}>
          No puedo completar el servicio: registrar una incidencia
        </button>
      </>
    );
  }
  if (service.status === 'delivered') {
    return (
      <p className="booking__notice booking__notice--ok" role="status">
        Servicio completado. <Link to={`/pruebas/${service.id}`}>Ver la prueba</Link>
      </p>
    );
  }
  if (service.status === 'incident') {
    return (
      <p className="booking__notice booking__notice--expired" role="status">
        Has registrado una incidencia en este servicio. <Link to={`/pruebas/${service.id}`}>Ver detalle</Link>
      </p>
    );
  }
  return null;
}
