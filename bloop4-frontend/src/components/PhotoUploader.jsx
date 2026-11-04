import { useState } from 'react';
import { checkPhoto, deleteImage, uploadImage } from '../api/sellerApi';

export const MAX_PHOTOS = 10;
let nextKey = 0;

/**
 * Fotos d'un producte: les ja pujades (amb botó per esborrar-les) i les que s'estan pujant,
 * cadascuna amb el seu progrés. Si una pujada falla, només cal reintentar aquella foto.
 */
export default function PhotoUploader({ productId, images, onChange }) {
  const [uploads, setUploads] = useState([]);
  const [error, setError] = useState(null);

  const patch = (key, changes) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...changes } : u)));

  async function send(item) {
    patch(item.key, { status: 'uploading', progress: 0, error: null });
    try {
      const image = await uploadImage(productId, item.file, { onProgress: (progress) => patch(item.key, { progress }) });
      setUploads((list) => list.filter((u) => u.key !== item.key));
      onChange((current) => [...current, image]);
    } catch (err) {
      patch(item.key, { status: 'error', error: err.message });
    }
  }

  function choose(event) {
    const files = [...event.target.files];
    event.target.value = '';
    setError(null);
    const room = MAX_PHOTOS - images.length - uploads.length;
    const problems = files.map(checkPhoto).filter(Boolean);
    const valid = files.filter((file) => !checkPhoto(file)).slice(0, Math.max(room, 0));
    if (files.filter((file) => !checkPhoto(file)).length > room) problems.push(`Como máximo ${MAX_PHOTOS} fotos por producto.`);
    if (problems.length) setError(problems.join(' '));

    const items = valid.map((file) => ({ key: ++nextKey, file, status: 'uploading', progress: 0, error: null }));
    setUploads((list) => [...list, ...items]);
    items.forEach(send);
  }

  async function remove(image) {
    setError(null);
    try {
      await deleteImage(productId, image.id);
      onChange((current) => current.filter((i) => i.id !== image.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="photos">
      <ul className="photos__list" aria-label="Fotos del producto">
        {images.map((image) => (
          <li key={image.id} className="photos__item">
            <img src={image.path} alt={image.altText} width="120" height="96" loading="lazy" />
            <button type="button" className="link-button" onClick={() => remove(image)} aria-label={`Eliminar ${image.path.split('/').pop()}`}>
              Eliminar
            </button>
          </li>
        ))}
        {uploads.map((item) => (
          <li key={item.key} className="photos__item photos__item--pending">
            <span className="photos__name">{item.file.name}</span>
            {item.status === 'uploading' ? (
              <progress max="1" value={item.progress} aria-label={`Subiendo ${item.file.name}`} />
            ) : (
              <>
                <span className="form__error" role="alert">{item.error}</span>
                <button type="button" className="link-button" onClick={() => send(item)}>
                  Reintentar
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {images.length + uploads.length < MAX_PHOTOS && (
        <label className="btn-outline photos__add">
          Añadir fotos
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choose} hidden />
        </label>
      )}
      <p className="form__hint">JPEG, PNG o WebP · máximo 10 MB por foto · hasta {MAX_PHOTOS} fotos.</p>
      {error && <p className="form__error" role="alert">{error}</p>}
    </div>
  );
}
