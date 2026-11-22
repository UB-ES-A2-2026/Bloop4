import { useEffect, useState } from 'react';
import { checkPhoto } from '../api/sellerApi';
import { completeService, deleteProofPhoto, fetchProofPhotos, uploadProofPhoto } from '../api/riderApi';
import { CONDITION_LABEL } from '../lib/services';

let nextKey = 0;

/** Fotos d'una línia: les pujades (amb opció d'esborrar-les) i les que fallen, amb «Reintentar». */
function LinePhotos({ serviceId, item, photos, onUploaded, onRemoved }) {
  const [failed, setFailed] = useState([]);
  const [uploading, setUploading] = useState(0);

  async function send(file, key) {
    setUploading((n) => n + 1);
    setFailed((list) => list.filter((f) => f.key !== key));
    try {
      onUploaded(await uploadProofPhoto(serviceId, file, item.eventItemId));
    } catch (err) {
      setFailed((list) => [...list, { key, file, error: err.message }]);
    }
    setUploading((n) => n - 1);
  }

  function choose(event) {
    const files = [...event.target.files];
    event.target.value = '';
    for (const file of files) {
      const problem = checkPhoto(file);
      if (problem) setFailed((list) => [...list, { key: ++nextKey, file: null, error: problem }]);
      else send(file, ++nextKey);
    }
  }

  return (
    <div className="proof__photos">
      <ul className="photos__list" aria-label={`Fotos de ${item.name}`}>
        {photos.map((photo) => (
          <li key={photo.id} className="photos__item">
            <img src={photo.url} alt={`Foto de ${item.name}`} width="96" height="72" loading="lazy" />
            <button type="button" className="link-button" onClick={() => onRemoved(photo)}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      {uploading > 0 && <p className="form__hint" role="status">Subiendo {uploading === 1 ? 'una foto' : `${uploading} fotos`}…</p>}
      {failed.map((f) => (
        <p key={f.key} className="form__error" role="alert">
          {f.error}{' '}
          {f.file && (
            <button type="button" className="link-button" onClick={() => send(f.file, f.key)}>
              Reintentar
            </button>
          )}
        </p>
      ))}
      <label className="btn-outline photos__add">
        Añadir foto
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={choose} hidden />
      </label>
    </div>
  );
}

/**
 * Checklist del rider per completar un servei en curs: estat i almenys una foto de cada línia.
 * Si alguna cosa falla, el que s'ha omplert es conserva.
 */
export default function ProofForm({ service, onCompleted }) {
  const [photos, setPhotos] = useState([]);
  const [lines, setLines] = useState(() => Object.fromEntries(service.items.map((i) => [i.eventItemId, { condition: '', note: '' }])));
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchProofPhotos(service.id, { signal: controller.signal })
      .then(setPhotos)
      .catch(() => {});
    return () => controller.abort();
  }, [service.id]);

  const set = (id, changes) => setLines((all) => ({ ...all, [id]: { ...all[id], ...changes } }));

  async function remove(photo) {
    try {
      await deleteProofPhoto(service.id, photo.id);
      setPhotos((list) => list.filter((p) => p.id !== photo.id));
    } catch (err) {
      setError(err.message);
    }
  }

  function validate() {
    const found = {};
    for (const item of service.items) {
      const line = lines[item.eventItemId];
      const problems = [];
      if (!photos.some((p) => p.eventItemId === item.eventItemId)) problems.push('Falta al menos una foto.');
      if (!line.condition) problems.push('Indica el estado.');
      else if (line.condition !== 'correct' && line.note.trim().length < 3) problems.push('Explica qué le pasa al material.');
      if (problems.length) found[item.eventItemId] = problems.join(' ');
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setSending(true);
    try {
      const items = service.items.map((item) => ({
        eventItemId: item.eventItemId,
        condition: lines[item.eventItemId].condition,
        note: lines[item.eventItemId].note.trim() || undefined,
      }));
      onCompleted(await completeService(service.id, items));
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  const action = service.type === 'delivery' ? 'entrega' : 'recogida';
  return (
    <form className="proof" onSubmit={submit} noValidate aria-labelledby="proof-title">
      <h2 id="proof-title" className="detail__subtitle">Completar la {action}</h2>
      <p className="form__hint">Haz al menos una foto de cada producto e indica en qué estado está.</p>
      {service.items.map((item) => {
        const line = lines[item.eventItemId];
        return (
          <fieldset key={item.eventItemId} className="proof__line" aria-invalid={Boolean(errors[item.eventItemId])}>
            <legend>
              {item.quantity} × {item.name}
            </legend>
            <LinePhotos
              serviceId={service.id}
              item={item}
              photos={photos.filter((p) => p.eventItemId === item.eventItemId)}
              onUploaded={(photo) => setPhotos((list) => [...list, photo])}
              onRemoved={remove}
            />
            <div className="proof__conditions" role="radiogroup" aria-label={`Estado de ${item.name}`}>
              {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                <label key={value} className="form__check">
                  <input
                    type="radio"
                    name={`condition-${item.eventItemId}`}
                    value={value}
                    checked={line.condition === value}
                    onChange={() => set(item.eventItemId, { condition: value })}
                  />{' '}
                  {label}
                </label>
              ))}
            </div>
            {line.condition && line.condition !== 'correct' && (
              <label className="form__field">
                <span className="form__label">¿Qué le pasa?</span>
                <textarea className="form__input" maxLength={1000} value={line.note} onChange={(e) => set(item.eventItemId, { note: e.target.value })} />
              </label>
            )}
            {errors[item.eventItemId] && <p className="form__error">{errors[item.eventItemId]}</p>}
          </fieldset>
        );
      })}
      {error && <p className="form__error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={sending}>
        {sending ? 'Guardando…' : `Completar ${action}`}
      </button>
    </form>
  );
}
