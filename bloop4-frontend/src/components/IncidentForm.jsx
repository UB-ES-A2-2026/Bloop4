import { useState } from 'react';
import { checkPhoto } from '../api/sellerApi';
import { reportIncident, uploadProofPhoto } from '../api/riderApi';
import { INCIDENT_KIND_LABEL } from '../lib/services';

/**
 * El rider no pot completar el servei (client absent, etc.): registra la incidència amb el motiu i,
 * si cal, una foto. El servei no es marca com a completat.
 */
export default function IncidentForm({ service, onReported, onCancel }) {
  const [kind, setKind] = useState('customer_absent');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (description.trim().length < 3) return setError('Explica qué ha pasado.');
    if (file && checkPhoto(file)) return setError(checkPhoto(file));
    setSending(true);
    setError(null);
    try {
      const photo = file ? await uploadProofPhoto(service.id, file, null) : null;
      await reportIncident(service.id, { kind, description: description.trim(), photoId: photo?.id });
      onReported();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <form className="proof" onSubmit={submit} noValidate aria-labelledby="incident-title">
      <h2 id="incident-title" className="detail__subtitle">Registrar una incidencia</h2>
      <label className="form__field">
        <span className="form__label">Motivo</span>
        <select className="form__input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(INCIDENT_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="form__field">
        <span className="form__label">Qué ha pasado</span>
        <textarea className="form__input" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="form__field">
        <span className="form__label">Foto (opcional)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setFile(e.target.files[0] ?? null)} />
      </label>
      {error && <p className="form__error" role="alert">{error}</p>}
      <div className="service__actions">
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? 'Enviando…' : 'Registrar incidencia'}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Volver
        </button>
      </div>
    </form>
  );
}
